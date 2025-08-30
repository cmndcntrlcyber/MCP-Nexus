import { EventEmitter } from 'events';
import axios, { AxiosInstance, AxiosError } from 'axios';

export interface BridgeClientConfig {
  id: string;
  name: string;
  type: 'bug_hunter' | 'rt_dev' | 'burpsuite_operator' | 'daedelu5' | 'nexus_kamuy';
  baseUrl: string;
  apiKey?: string;
  bearerToken?: string;
  capabilities: string[];
  healthCheckInterval?: number;
  maxRetries?: number;
  requestTimeout?: number;
}

export interface BridgeToolInvocation {
  clientId: string;
  toolName: string;
  parameters: Record<string, any>;
  correlationId?: string;
}

export interface BridgeToolResult {
  success: boolean;
  data?: any;
  result?: any;
  error?: string;
  executionTime?: number;
  correlationId?: string;
  agent?: string;
  capability?: string;
  endpoint_source?: string;
  endpoint_used?: string;
  status_code?: number;
}

export interface BridgeExecutePayload {
  tool_name: string;
  agent: string;
  parameters: Record<string, any>;
  request_id: string;
}

export class BridgeClientInstance extends EventEmitter {
  private config: BridgeClientConfig;
  private httpClient: AxiosInstance;
  private connected: boolean = false;
  private healthCheckTimer?: NodeJS.Timeout;
  private lastHealthCheck?: Date;
  private tools: string[] = [];
  private circuitBreakerOpen: boolean = false;
  private errorCount: number = 0;
  private lastError?: Date;

  constructor(config: BridgeClientConfig) {
    super();
    this.config = config;
    
    // Initialize HTTP client with bridge-specific configuration
    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: config.requestTimeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MCP-Nexus-Bridge/1.0.0',
      }
    });

    // Add request interceptors for authentication
    this.httpClient.interceptors.request.use((config) => {
      if (this.config.bearerToken) {
        config.headers['Authorization'] = `Bearer ${this.config.bearerToken}`;
      }
      if (this.config.apiKey) {
        config.headers['X-API-Key'] = this.config.apiKey;
      }
      return config;
    });

    // Add response interceptors for error handling
    this.httpClient.interceptors.response.use(
      (response) => {
        this.resetCircuitBreaker();
        return response;
      },
      (error) => {
        this.handleError(error);
        throw error;
      }
    );

    // Set capabilities based on agent type
    this.initializeCapabilities();

    // Setup health checking
    if (config.healthCheckInterval) {
      this.startHealthChecking();
    }
  }

  private initializeCapabilities(): void {
    const capabilityMap = {
      bug_hunter: ['vulnerability_scan', 'framework_detection', 'security_analysis'],
      rt_dev: ['code_generation', 'infrastructure_deployment', 'payload_creation'],
      burpsuite_operator: ['web_scan', 'proxy_analysis', 'payload_testing'],
      daedelu5: ['compliance_check', 'audit_analysis', 'advanced_testing'],
      nexus_kamuy: ['workflow_orchestration', 'task_coordination', 'agent_management']
    };

    this.tools = capabilityMap[this.config.type] || [];
  }

  async connect(): Promise<void> {
    try {
      // Test connectivity with the bridge
      await this.testBridgeConnection();
      
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
    
    this.emit('disconnected', { clientId: this.config.id });
  }

  async invokeTool(toolName: string, parameters: Record<string, any>, correlationId?: string): Promise<BridgeToolResult> {
    if (!this.connected) {
      throw new Error(`Client ${this.config.id} is not connected`);
    }

    if (this.circuitBreakerOpen) {
      throw new Error(`Circuit breaker is open for client ${this.config.id}`);
    }

    if (!this.tools.includes(toolName)) {
      throw new Error(`Tool '${toolName}' not available on client ${this.config.id}`);
    }

    const startTime = Date.now();
    const requestId = correlationId || `bridge_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    try {
      // Build bridge payload
      const payload: BridgeExecutePayload = {
        tool_name: toolName,
        agent: this.config.id,
        parameters: {
          ...parameters,
          context: {
            correlation_id: requestId,
            agent_type: this.config.type,
            user_id: 'mcp_nexus_system'
          }
        },
        request_id: requestId
      };

      // Make request to bridge execute endpoint
      const response = await this.executeBridgeRequest(payload);
      const executionTime = Date.now() - startTime;
      
      const result: BridgeToolResult = {
        success: response.success || false,
        data: response.result || response.data,
        result: response.result || response.data,
        executionTime,
        correlationId: requestId,
        agent: this.config.id,
        capability: toolName,
        endpoint_source: response.endpoint_source || 'bridge',
        endpoint_used: response.endpoint_used || '/execute',
        status_code: response.status_code
      };

      if (!result.success && response.error) {
        result.error = response.error;
      }

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
      
      const result: BridgeToolResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
        correlationId: requestId,
        agent: this.config.id,
        capability: toolName
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

  private async executeBridgeRequest(payload: BridgeExecutePayload): Promise<any> {
    const maxRetries = this.config.maxRetries || 3;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.httpClient.post('/execute', payload);
        
        if (response.status === 200) {
          return {
            success: true,
            ...response.data
          };
        }
        
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          status_code: response.status
        };

      } catch (error) {
        if (axios.isAxiosError(error)) {
          const axiosError = error as AxiosError;
          
          // Handle rate limiting
          if (axiosError.response?.status === 429) {
            if (attempt < maxRetries) {
              const delay = Math.pow(2, attempt) * 1000;
              await this.sleep(delay);
              continue;
            }
          }
          
          // Handle timeout
          if (axiosError.code === 'ECONNABORTED') {
            if (attempt < maxRetries) {
              await this.sleep(1000 * (attempt + 1));
              continue;
            }
          }

          return {
            success: false,
            error: `HTTP Error: ${axiosError.response?.status || 'Network Error'} - ${axiosError.message}`,
            status_code: axiosError.response?.status
          };
        }
        
        if (attempt < maxRetries) {
          await this.sleep(1000 * (attempt + 1));
          continue;
        }
        
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    return {
      success: false,
      error: `Failed after ${maxRetries + 1} attempts`
    };
  }

  private async testBridgeConnection(): Promise<void> {
    try {
      // Try to ping the bridge endpoint
      const response = await this.httpClient.get('/health');
      if (response.status !== 200) {
        throw new Error(`Bridge health check failed with status ${response.status}`);
      }
    } catch (error) {
      // If /health doesn't exist, try the execute endpoint with a test payload
      try {
        const testPayload: BridgeExecutePayload = {
          tool_name: 'ping',
          agent: this.config.id,
          parameters: { test: true },
          request_id: `health_check_${Date.now()}`
        };
        
        await this.httpClient.post('/execute', testPayload);
      } catch (testError) {
        throw new Error(`Bridge connectivity test failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private handleError(error: AxiosError): void {
    this.errorCount++;
    this.lastError = new Date();

    // Open circuit breaker after 5 consecutive errors
    if (this.errorCount >= 5) {
      this.circuitBreakerOpen = true;
      setTimeout(() => {
        this.circuitBreakerOpen = false;
        this.errorCount = 0;
      }, 60000); // 1 minute circuit breaker timeout
    }
  }

  private resetCircuitBreaker(): void {
    this.circuitBreakerOpen = false;
    this.errorCount = 0;
  }

  private startHealthChecking(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.testBridgeConnection();
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getAvailableTools(): string[] {
    return [...this.tools];
  }

  getAvailableResources(): string[] {
    return []; // Bridge doesn't expose resources in the same way
  }

  getClientInfo(): BridgeClientConfig & { connected: boolean; lastHealthCheck?: Date; circuitBreakerOpen: boolean } {
    return {
      ...this.config,
      connected: this.connected,
      lastHealthCheck: this.lastHealthCheck,
      circuitBreakerOpen: this.circuitBreakerOpen
    };
  }
}

export class BridgeClientManager extends EventEmitter {
  private clients: Map<string, BridgeClientInstance> = new Map();
  private workflowExecutions: Map<string, any> = new Map();

  async addClient(config: BridgeClientConfig): Promise<void> {
    if (this.clients.has(config.id)) {
      throw new Error(`Client with ID ${config.id} already exists`);
    }

    const client = new BridgeClientInstance(config);
    
    // Forward events
    client.on('connected', (data: any) => this.emit('clientConnected', data));
    client.on('disconnected', (data: any) => this.emit('clientDisconnected', data));
    client.on('error', (data: any) => this.emit('clientError', data));
    client.on('toolInvoked', (data: any) => this.emit('toolInvoked', data));
    client.on('toolError', (data: any) => this.emit('toolError', data));
    client.on('healthCheck', (data: any) => this.emit('clientHealthCheck', data));

    this.clients.set(config.id, client);
    
    // Attempt to connect
    try {
      await client.connect();
    } catch (error) {
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

  async invokeToolOnClient(clientId: string, toolName: string, parameters: Record<string, any>, correlationId?: string): Promise<BridgeToolResult> {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    return await client.invokeTool(toolName, parameters, correlationId);
  }

  async executeDistributedWorkflow(workflow: any): Promise<string> {
    const distributedWorkflowId = `distributed-workflow-${Date.now()}`;
    
    try {
      const requiredClients = this.analyzeWorkflowRequirements(workflow);
      
      // Verify all required clients are available
      for (const clientId of requiredClients) {
        const client = this.clients.get(clientId);
        if (!client || !client.getClientInfo().connected) {
          throw new Error(`Required client ${clientId} is not available`);
        }
      }
      
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
          workflow.steps
            .filter((s: any, idx: number) => idx > i && s.dependsOn?.includes(step.name))
            .forEach((dependentStep: any) => {
              dependentStep.parameters = {
                ...dependentStep.parameters,
                [step.outputTo]: result.data || result.result
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
    const suitableClient = this.findSuitableClientForTool(step.toolName);
    
    if (!suitableClient) {
      throw new Error(`No suitable client found for tool: ${step.toolName}`);
    }
    
    return suitableClient;
  }

  getWorkflowStatus(workflowId: string): any {
    return this.workflowExecutions.get(workflowId);
  }

  getAllClients(): Array<BridgeClientConfig & { connected: boolean; lastHealthCheck?: Date; circuitBreakerOpen: boolean }> {
    return Array.from(this.clients.values()).map(client => client.getClientInfo());
  }

  getClient(clientId: string): BridgeClientInstance | undefined {
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
}
