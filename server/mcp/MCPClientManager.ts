import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import axios, { AxiosInstance } from 'axios';

export interface MCPClientConfig {
  id: string;
  name: string;
  type: 'attack-node' | 'rtpi-pen' | 'nexus-kamuy';
  baseUrl: string;
  apiKey?: string;
  websocketUrl?: string;
  capabilities: string[];
  healthCheckInterval?: number;
}

export interface MCPToolInvocation {
  clientId: string;
  toolName: string;
  parameters: Record<string, any>;
  correlationId?: string;
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime?: number;
  correlationId?: string;
}

export class MCPClientInstance extends EventEmitter {
  private config: MCPClientConfig;
  private httpClient: AxiosInstance;
  private websocket?: WebSocket;
  private connected: boolean = false;
  private healthCheckTimer?: NodeJS.Timeout;
  private lastHealthCheck?: Date;
  private tools: string[] = [];
  private resources: string[] = [];

  constructor(config: MCPClientConfig) {
    super();
    this.config = config;
    
    // Initialize HTTP client
    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
      }
    });

    // Setup health checking
    if (config.healthCheckInterval) {
      this.startHealthChecking();
    }
  }

  async connect(): Promise<void> {
    try {
      // Test HTTP connectivity
      await this.testHttpConnection();
      
      // Discover available tools and resources
      await this.discoverCapabilities();
      
      // Setup WebSocket if available
      if (this.config.websocketUrl) {
        await this.connectWebSocket();
      }
      
      this.connected = true;
      this.emit('connected', { clientId: this.config.id });
      
    } catch (error) {
      this.emit('error', { 
        clientId: this.config.id, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    if (this.websocket) {
      this.websocket.close();
    }
    
    this.emit('disconnected', { clientId: this.config.id });
  }

  async invokeTool(toolName: string, parameters: Record<string, any>, correlationId?: string): Promise<MCPToolResult> {
    if (!this.connected) {
      throw new Error(`Client ${this.config.id} is not connected`);
    }

    if (!this.tools.includes(toolName)) {
      throw new Error(`Tool '${toolName}' not available on client ${this.config.id}`);
    }

    const startTime = Date.now();
    
    try {
      const response = await this.httpClient.post('/mcp/tools/invoke', {
        tool: toolName,
        parameters,
        correlationId
      });

      const executionTime = Date.now() - startTime;
      
      const result: MCPToolResult = {
        success: true,
        data: response.data,
        executionTime,
        correlationId
      };

      this.emit('toolInvoked', {
        clientId: this.config.id,
        toolName,
        parameters,
        result,
        executionTime
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      const result: MCPToolResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        correlationId
      };

      this.emit('toolError', {
        clientId: this.config.id,
        toolName,
        parameters,
        error: result.error,
        executionTime
      });

      return result;
    }
  }

  async getResource(resourceUri: string): Promise<any> {
    if (!this.connected) {
      throw new Error(`Client ${this.config.id} is not connected`);
    }

    try {
      const response = await this.httpClient.get('/mcp/resources', {
        params: { uri: resourceUri }
      });

      return response.data;

    } catch (error) {
      this.emit('resourceError', {
        clientId: this.config.id,
        resourceUri,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  getAvailableTools(): string[] {
    return [...this.tools];
  }

  getAvailableResources(): string[] {
    return [...this.resources];
  }

  getClientInfo(): MCPClientConfig & { connected: boolean; lastHealthCheck?: Date } {
    return {
      ...this.config,
      connected: this.connected,
      lastHealthCheck: this.lastHealthCheck
    };
  }

  private async testHttpConnection(): Promise<void> {
    try {
      await this.httpClient.get('/health');
    } catch (error) {
      // Try alternative health endpoints
      try {
        await this.httpClient.get('/mcp/health');
      } catch (secondError) {
        throw new Error(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async discoverCapabilities(): Promise<void> {
    try {
      // Try to get tools
      try {
        const toolsResponse = await this.httpClient.get('/mcp/tools/list');
        this.tools = toolsResponse.data.tools || [];
      } catch (error) {
        // Try alternative endpoint
        try {
          const altResponse = await this.httpClient.get('/api/tools');
          this.tools = altResponse.data.tools || [];
        } catch (altError) {
          console.warn(`Could not discover tools for ${this.config.name}`);
        }
      }
      
      // Try to get resources
      try {
        const resourcesResponse = await this.httpClient.get('/mcp/resources/list');
        this.resources = resourcesResponse.data.resources || [];
      } catch (error) {
        // Try alternative endpoint
        try {
          const altResponse = await this.httpClient.get('/api/resources');
          this.resources = altResponse.data.resources || [];
        } catch (altError) {
          console.warn(`Could not discover resources for ${this.config.name}`);
        }
      }
      
    } catch (error) {
      console.warn(`Failed to discover capabilities for ${this.config.name}: ${error}`);
    }
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.websocket = new WebSocket(this.config.websocketUrl!);
        
        this.websocket.on('open', () => {
          resolve();
        });
        
        this.websocket.on('message', (data: any) => {
          try {
            const message = JSON.parse(data.toString());
            this.emit('message', {
              clientId: this.config.id,
              message
            });
          } catch (error) {
            this.emit('parseError', {
              clientId: this.config.id,
              error: error instanceof Error ? error.message : String(error),
              rawData: data.toString()
            });
          }
        });
        
        this.websocket.on('error', (error: any) => {
          reject(error);
        });
        
        this.websocket.on('close', () => {
          this.emit('websocketClosed', { clientId: this.config.id });
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }

  private startHealthChecking(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.testHttpConnection();
        this.lastHealthCheck = new Date();
        this.emit('healthCheck', {
          clientId: this.config.id,
          healthy: true,
          timestamp: this.lastHealthCheck
        });
      } catch (error) {
        this.emit('healthCheck', {
          clientId: this.config.id,
          healthy: false,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date()
        });
      }
    }, this.config.healthCheckInterval || 60000);
  }
}

export class MCPClientManager extends EventEmitter {
  private clients: Map<string, MCPClientInstance> = new Map();
  private workflowExecutions: Map<string, any> = new Map();

  async addClient(config: MCPClientConfig): Promise<void> {
    if (this.clients.has(config.id)) {
      throw new Error(`Client with ID ${config.id} already exists`);
    }

    const client = new MCPClientInstance(config);
    
    // Forward events
    client.on('connected', (data: any) => this.emit('clientConnected', data));
    client.on('disconnected', (data: any) => this.emit('clientDisconnected', data));
    client.on('error', (data: any) => this.emit('clientError', data));
    client.on('toolInvoked', (data: any) => this.emit('toolInvoked', data));
    client.on('toolError', (data: any) => this.emit('toolError', data));
    client.on('message', (data: any) => this.emit('clientMessage', data));
    client.on('healthCheck', (data: any) => this.emit('clientHealthCheck', data));

    this.clients.set(config.id, client);
    
    // Attempt to connect
    try {
      await client.connect();
    } catch (error) {
      // Client added but connection failed - can retry later
      console.warn(`Failed to connect client ${config.id}: ${error}`);
    }
  }

  async removeClient(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    await client.disconnect();
    this.clients.delete(clientId);
  }

  async invokeToolOnClient(clientId: string, toolName: string, parameters: Record<string, any>, correlationId?: string): Promise<MCPToolResult> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    return await client.invokeTool(toolName, parameters, correlationId);
  }

  async executeWorkflow(workflowSpec: any): Promise<string> {
    const workflowId = `workflow-${Date.now()}`;
    
    try {
      this.workflowExecutions.set(workflowId, {
        id: workflowId,
        spec: workflowSpec,
        status: 'running',
        startTime: new Date(),
        steps: [],
        currentStep: 0
      });

      // Execute workflow steps
      const execution = this.workflowExecutions.get(workflowId)!;
      
      for (let i = 0; i < workflowSpec.steps.length; i++) {
        const step = workflowSpec.steps[i];
        execution.currentStep = i;
        
        try {
          const result = await this.executeWorkflowStep(step);
          execution.steps.push({
            stepIndex: i,
            stepName: step.name,
            result,
            timestamp: new Date()
          });
          
          this.emit('workflowStepCompleted', {
            workflowId,
            stepIndex: i,
            stepName: step.name,
            result
          });
          
        } catch (stepError) {
          execution.status = 'failed';
          execution.error = stepError instanceof Error ? stepError.message : String(stepError);
          execution.failedStep = i;
          
          this.emit('workflowFailed', {
            workflowId,
            failedStep: i,
            error: execution.error
          });
          
          throw stepError;
        }
      }
      
      execution.status = 'completed';
      execution.endTime = new Date();
      
      this.emit('workflowCompleted', {
        workflowId,
        executionTime: execution.endTime.getTime() - execution.startTime.getTime(),
        stepsCompleted: execution.steps.length
      });
      
      return workflowId;
      
    } catch (error) {
      const execution = this.workflowExecutions.get(workflowId);
      if (execution) {
        execution.status = 'failed';
        execution.error = error instanceof Error ? error.message : String(error);
        execution.endTime = new Date();
      }
      throw error;
    }
  }

  private async executeWorkflowStep(step: any): Promise<MCPToolResult> {
    const { clientId, toolName, parameters } = step;
    
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found for step ${step.name}`);
    }

    return await client.invokeTool(toolName, parameters);
  }

  getWorkflowStatus(workflowId: string): any {
    return this.workflowExecutions.get(workflowId);
  }

  getAllClients(): Array<MCPClientConfig & { connected: boolean; lastHealthCheck?: Date }> {
    return Array.from(this.clients.values()).map(client => client.getClientInfo());
  }

  getClient(clientId: string): MCPClientInstance | undefined {
    return this.clients.get(clientId);
  }

  async getAggregatedCapabilities(): Promise<any> {
    const capabilities = {
      tools: {} as Record<string, string[]>,
      resources: {} as Record<string, string[]>,
      clients: [] as string[]
    };

    for (const [clientId, client] of this.clients.entries()) {
      capabilities.clients.push(clientId);
      capabilities.tools[clientId] = client.getAvailableTools();
      capabilities.resources[clientId] = client.getAvailableResources();
    }

    return capabilities;
  }

  async broadcastMessage(message: any, excludeClient?: string): Promise<void> {
    for (const [clientId, client] of this.clients.entries()) {
      if (clientId !== excludeClient && client.getClientInfo().connected) {
        try {
          // Send via WebSocket if available
          const ws = (client as any).websocket;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
          }
        } catch (error) {
          this.emit('broadcastError', {
            clientId,
            message,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
  }

  async executeDistributedWorkflow(workflow: any): Promise<string> {
    // Create a workflow that spans multiple MCP clients
    const distributedWorkflowId = `distributed-workflow-${Date.now()}`;
    
    try {
      // Analyze workflow to determine which clients are needed
      const requiredClients = this.analyzeWorkflowRequirements(workflow);
      
      // Verify all required clients are available
      for (const clientId of requiredClients) {
        const client = this.clients.get(clientId);
        if (!client || !client.getClientInfo().connected) {
          throw new Error(`Required client ${clientId} is not available`);
        }
      }
      
      // Execute the distributed workflow
      const workflowExecution = {
        id: distributedWorkflowId,
        type: 'distributed',
        requiredClients,
        steps: workflow.steps,
        status: 'running',
        startTime: new Date(),
        endTime: undefined as Date | undefined,
        results: {} as Record<string, any>
      };
      
      this.workflowExecutions.set(distributedWorkflowId, workflowExecution);
      
      // Execute steps across different clients
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        const clientId = step.clientId || this.selectBestClientForStep(step);
        
        const result = await this.invokeToolOnClient(
          clientId,
          step.toolName,
          step.parameters,
          `${distributedWorkflowId}-step-${i}`
        );
        
        workflowExecution.results[`step_${i}`] = {
          clientId,
          toolName: step.toolName,
          result,
          timestamp: new Date()
        };
        
        // Allow for step dependencies and data passing
        if (step.outputTo && result.success) {
          // Pass result to next steps that depend on this one
          workflow.steps
            .filter((s: any, idx: number) => idx > i && s.dependsOn?.includes(step.name))
            .forEach((dependentStep: any) => {
              dependentStep.parameters = {
                ...dependentStep.parameters,
                [step.outputTo]: result.data
              };
            });
        }
      }
      
      workflowExecution.status = 'completed';
      workflowExecution.endTime = new Date();
      
      this.emit('distributedWorkflowCompleted', {
        workflowId: distributedWorkflowId,
        results: workflowExecution.results
      });
      
      return distributedWorkflowId;
      
    } catch (error) {
      const execution = this.workflowExecutions.get(distributedWorkflowId);
      if (execution) {
        execution.status = 'failed';
        execution.error = error instanceof Error ? error.message : String(error);
        execution.endTime = new Date();
      }
      
      this.emit('distributedWorkflowFailed', {
        workflowId: distributedWorkflowId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  private analyzeWorkflowRequirements(workflow: any): string[] {
    const requiredClients = new Set<string>();
    
    for (const step of workflow.steps) {
      if (step.clientId) {
        requiredClients.add(step.clientId);
      } else {
        // Determine which client can handle this step
        const suitableClient = this.findSuitableClientForTool(step.toolName);
        if (suitableClient) {
          requiredClients.add(suitableClient);
        }
      }
    }
    
    return Array.from(requiredClients);
  }

  private findSuitableClientForTool(toolName: string): string | null {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.getAvailableTools().includes(toolName)) {
        return clientId;
      }
    }
    return null;
  }

  private selectBestClientForStep(step: any): string {
    // Default selection logic - prefer based on tool availability and client type
    const suitableClient = this.findSuitableClientForTool(step.toolName);
    
    if (!suitableClient) {
      throw new Error(`No suitable client found for tool: ${step.toolName}`);
    }
    
    return suitableClient;
  }
}
