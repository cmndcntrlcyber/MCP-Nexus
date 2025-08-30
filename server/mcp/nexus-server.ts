#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { BridgeClientManager, BridgeClientConfig } from './BridgeClientManager.js';
import { MCPServerManager } from './MCPServerManager.js';

interface WorkflowDefinition {
  name: string;
  type: 'security_assessment' | 'penetration_test' | 'compliance_audit' | 'infrastructure_scan';
  target: string;
  steps: Array<{
    name: string;
    clientId: string;
    toolName: string;
    parameters: Record<string, any>;
    dependsOn?: string[];
    outputTo?: string;
  }>;
}

class MCPNexusServer {
  private server: Server;
  private clientManager: BridgeClientManager;
  private serverManager: MCPServerManager;
  private workflows: Map<string, WorkflowDefinition> = new Map();

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-nexus-orchestrator',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.clientManager = new BridgeClientManager();
    this.serverManager = new MCPServerManager();

    this.setupResourceHandlers();
    this.setupToolHandlers();
    this.initializeClients();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Nexus Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async initializeClients() {
    try {
      // Get bridge configuration from environment variables
      const offsecApiUrl = process.env.OFFSEC_API_URL || 'https://offsec-team.attck-community.workers.dev';
      const researchMcpUrl = process.env.RESEARCH_MCP_URL || 'https://research-agent-mcp.attck-community.workers.dev';
      const bearerToken = process.env.BRIDGE_BEARER_TOKEN || '';
      const apiKey = process.env.BRIDGE_API_KEY || '';

      // Initialize bug_hunter client (vulnerability scanning)
      await this.clientManager.addClient({
        id: 'bug_hunter',
        name: 'Bug Hunter Security Scanner',
        type: 'bug_hunter',
        baseUrl: offsecApiUrl,
        bearerToken,
        apiKey,
        capabilities: [
          'vulnerability_scan',
          'framework_detection', 
          'security_analysis'
        ],
        healthCheckInterval: 30000,
        maxRetries: 3,
        requestTimeout: 30000
      });

      // Initialize rt_dev client (red team development)
      await this.clientManager.addClient({
        id: 'rt_dev',
        name: 'Red Team Development',
        type: 'rt_dev',
        baseUrl: offsecApiUrl,
        bearerToken,
        apiKey,
        capabilities: [
          'code_generation',
          'infrastructure_deployment',
          'payload_creation'
        ],
        healthCheckInterval: 30000,
        maxRetries: 3,
        requestTimeout: 30000
      });

      // Initialize burpsuite_operator client
      await this.clientManager.addClient({
        id: 'burpsuite_operator',
        name: 'Burp Suite Operator',
        type: 'burpsuite_operator',
        baseUrl: offsecApiUrl,
        bearerToken,
        apiKey,
        capabilities: [
          'web_scan',
          'proxy_analysis',
          'payload_testing'
        ],
        healthCheckInterval: 30000,
        maxRetries: 3,
        requestTimeout: 30000
      });

      // Initialize daedelu5 client (penetration testing)
      await this.clientManager.addClient({
        id: 'daedelu5',
        name: 'Daedelu5 Penetration Tester',
        type: 'daedelu5',
        baseUrl: offsecApiUrl,
        bearerToken,
        apiKey,
        capabilities: [
          'compliance_check',
          'audit_analysis',
          'advanced_testing'
        ],
        healthCheckInterval: 30000,
        maxRetries: 3,
        requestTimeout: 30000
      });

      // Initialize nexus_kamuy client (workflow orchestration)
      await this.clientManager.addClient({
        id: 'nexus_kamuy',
        name: 'Nexus Kamuy Orchestrator',
        type: 'nexus_kamuy',
        baseUrl: offsecApiUrl,
        bearerToken,
        apiKey,
        capabilities: [
          'workflow_orchestration',
          'task_coordination',
          'agent_management'
        ],
        healthCheckInterval: 30000,
        maxRetries: 3,
        requestTimeout: 30000
      });

      console.log('Bridge clients initialized successfully');
    } catch (error) {
      console.error('Failed to initialize bridge clients:', error);
    }
  }

  private setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: 'nexus://clients/status',
          name: 'MCP Client Status',
          mimeType: 'application/json',
          description: 'Status and health of all connected MCP clients'
        },
        {
          uri: 'nexus://workflows/active',
          name: 'Active Workflows',
          mimeType: 'application/json',
          description: 'Currently running multi-agent workflows'
        },
        {
          uri: 'nexus://capabilities/aggregated',
          name: 'Aggregated Capabilities',
          mimeType: 'application/json',
          description: 'Combined capabilities from all connected systems'
        },
        {
          uri: 'nexus://servers/status',
          name: 'MCP Server Status',
          mimeType: 'application/json',
          description: 'Status of managed MCP servers'
        }
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      switch (uri) {
        case 'nexus://clients/status':
          return await this.getClientsStatus();
        case 'nexus://workflows/active':
          return await this.getActiveWorkflows();
        case 'nexus://capabilities/aggregated':
          return await this.getAggregatedCapabilities();
        case 'nexus://servers/status':
          return await this.getServersStatus();
        default:
          throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
      }
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'execute_distributed_workflow',
          description: 'Execute a workflow that spans multiple MCP clients and systems',
          inputSchema: {
            type: 'object',
            properties: {
              workflow_name: {
                type: 'string',
                description: 'Name of the workflow to execute'
              },
              workflow_type: {
                type: 'string',
                enum: ['security_assessment', 'penetration_test', 'compliance_audit', 'infrastructure_scan'],
                description: 'Type of workflow to execute'
              },
              target: {
                type: 'string',
                description: 'Target system or application for the workflow'
              },
              parameters: {
                type: 'object',
                description: 'Additional parameters for the workflow execution'
              }
            },
            required: ['workflow_name', 'workflow_type', 'target']
          }
        },
        {
          name: 'coordinate_security_assessment',
          description: 'Coordinate a comprehensive security assessment using multiple agents',
          inputSchema: {
            type: 'object',
            properties: {
              target_url: {
                type: 'string',
                description: 'Target URL or IP address for assessment'
              },
              assessment_scope: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['web_vulnerabilities', 'infrastructure', 'compliance', 'framework_analysis']
                },
                description: 'Scope of the security assessment'
              },
              depth: {
                type: 'string',
                enum: ['surface', 'standard', 'deep'],
                default: 'standard',
                description: 'Depth of the assessment'
              }
            },
            required: ['target_url', 'assessment_scope']
          }
        },
        {
          name: 'manage_infrastructure_deployment',
          description: 'Manage infrastructure deployment across all systems',
          inputSchema: {
            type: 'object',
            properties: {
              deployment_name: {
                type: 'string',
                description: 'Name of the deployment'
              },
              services: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    image: { type: 'string' },
                    target_system: { type: 'string', enum: ['attack-node', 'rtpi-pen'] },
                    configuration: { type: 'object' }
                  }
                },
                description: 'Services to deploy'
              },
              coordination_config: {
                type: 'object',
                description: 'Coordination configuration between systems'
              }
            },
            required: ['deployment_name', 'services']
          }
        },
        {
          name: 'orchestrate_penetration_test',
          description: 'Orchestrate a comprehensive penetration test using all available tools',
          inputSchema: {
            type: 'object',
            properties: {
              target: {
                type: 'string',
                description: 'Target for penetration testing'
              },
              test_scope: {
                type: 'object',
                properties: {
                  web_application: { type: 'boolean' },
                  network_infrastructure: { type: 'boolean' },
                  social_engineering: { type: 'boolean' },
                  physical_security: { type: 'boolean' }
                },
                description: 'Scope of penetration testing'
              },
              test_methodology: {
                type: 'string',
                enum: ['owasp', 'nist', 'ptes', 'custom'],
                default: 'owasp',
                description: 'Testing methodology to follow'
              },
              reporting_requirements: {
                type: 'object',
                properties: {
                  executive_summary: { type: 'boolean' },
                  technical_details: { type: 'boolean' },
                  remediation_plan: { type: 'boolean' },
                  compliance_mapping: { type: 'array', items: { type: 'string' } }
                },
                description: 'Reporting requirements'
              }
            },
            required: ['target', 'test_scope']
          }
        },
        {
          name: 'sync_agent_knowledge',
          description: 'Synchronize knowledge and findings between all agents',
          inputSchema: {
            type: 'object',
            properties: {
              knowledge_type: {
                type: 'string',
                enum: ['vulnerabilities', 'configurations', 'policies', 'procedures'],
                description: 'Type of knowledge to synchronize'
              },
              source_agents: {
                type: 'array',
                items: { type: 'string' },
                description: 'Agents to pull knowledge from'
              },
              target_agents: {
                type: 'array',
                items: { type: 'string' },
                description: 'Agents to push knowledge to'
              }
            },
            required: ['knowledge_type']
          }
        },
        {
          name: 'monitor_system_health',
          description: 'Monitor health and performance across all connected systems',
          inputSchema: {
            type: 'object',
            properties: {
              monitoring_duration: {
                type: 'integer',
                default: 300,
                description: 'Monitoring duration in seconds'
              },
              metrics: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['system_resources', 'service_health', 'network_connectivity', 'security_status']
                },
                default: ['system_resources', 'service_health'],
                description: 'Metrics to monitor'
              },
              alert_thresholds: {
                type: 'object',
                description: 'Thresholds for generating alerts'
              }
            }
          }
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'execute_distributed_workflow':
          return this.executeDistributedWorkflow(args);
        case 'coordinate_security_assessment':
          return this.coordinateSecurityAssessment(args);
        case 'manage_infrastructure_deployment':
          return this.manageInfrastructureDeployment(args);
        case 'orchestrate_penetration_test':
          return this.orchestratePenetrationTest(args);
        case 'sync_agent_knowledge':
          return this.syncAgentKnowledge(args);
        case 'monitor_system_health':
          return this.monitorSystemHealth(args);
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    });
  }

  private async executeDistributedWorkflow(args: any): Promise<any> {
    const { workflow_name, workflow_type, target, parameters = {} } = args;

    try {
      // Create predefined workflows based on type
      let workflowSteps: any[] = [];

      switch (workflow_type) {
        case 'security_assessment':
          workflowSteps = [
            {
              name: 'web_vulnerability_scan',
              clientId: 'bug_hunter',
              toolName: 'vulnerability_scan',
              parameters: { target_url: target, scan_type: 'comprehensive', ...parameters }
            },
            {
              name: 'framework_analysis',
              clientId: 'bug_hunter',
              toolName: 'framework_detection',
              parameters: { target_url: target }
            },
            {
              name: 'burp_suite_scan',
              clientId: 'burpsuite_operator',
              toolName: 'web_scan',
              parameters: { target_url: target, scan_depth: 'standard' }
            },
            {
              name: 'generate_report',
              clientId: 'bug_hunter',
              toolName: 'security_analysis',
              parameters: { 
                target_url: target,
                assessment_name: workflow_name,
                report_format: 'json'
              },
              dependsOn: ['web_vulnerability_scan', 'framework_analysis', 'burp_suite_scan']
            }
          ];
          break;

        case 'penetration_test':
          workflowSteps = [
            {
              name: 'payload_generation',
              clientId: 'rt_dev',
              toolName: 'payload_creation',
              parameters: { 
                target: target,
                payload_type: 'web_shell',
                format: 'php'
              }
            },
            {
              name: 'comprehensive_scan',
              clientId: 'burpsuite_operator',
              toolName: 'web_scan',
              parameters: { target_url: target, scan_type: 'comprehensive' }
            },
            {
              name: 'advanced_testing',
              clientId: 'daedelu5',
              toolName: 'advanced_testing',
              parameters: { target: target, test_type: 'penetration' }
            },
            {
              name: 'vulnerability_analysis',
              clientId: 'bug_hunter',
              toolName: 'vulnerability_scan',
              parameters: { target_url: target, depth: 'deep' }
            }
          ];
          break;

        case 'compliance_audit':
          workflowSteps = [
            {
              name: 'compliance_assessment',
              clientId: 'daedelu5',
              toolName: 'compliance_check',
              parameters: { 
                target: target,
                standards: ['owasp', 'nist', 'iso27001'],
                audit_depth: 'comprehensive'
              }
            },
            {
              name: 'security_analysis',
              clientId: 'bug_hunter',
              toolName: 'security_analysis',
              parameters: { target_url: target, compliance_mode: true }
            },
            {
              name: 'audit_report',
              clientId: 'daedelu5',
              toolName: 'audit_analysis',
              parameters: { 
                target: target,
                compliance_results: {},
                report_format: 'detailed'
              },
              dependsOn: ['compliance_assessment', 'security_analysis']
            }
          ];
          break;

        case 'infrastructure_scan':
          workflowSteps = [
            {
              name: 'infrastructure_deployment',
              clientId: 'rt_dev',
              toolName: 'infrastructure_deployment',
              parameters: { 
                target: target,
                scan_type: 'infrastructure',
                deployment_check: true
              }
            },
            {
              name: 'security_assessment',
              clientId: 'bug_hunter',
              toolName: 'vulnerability_scan',
              parameters: { target_url: target, focus: 'infrastructure' }
            },
            {
              name: 'workflow_coordination',
              clientId: 'nexus_kamuy',
              toolName: 'workflow_orchestration',
              parameters: {
                workflow_type: 'infrastructure_scan',
                coordination_data: {}
              },
              dependsOn: ['infrastructure_deployment', 'security_assessment']
            }
          ];
          break;
      }

      // Execute the distributed workflow
      const workflowId = await this.clientManager.executeDistributedWorkflow({
        name: workflow_name,
        type: workflow_type,
        steps: workflowSteps
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              workflow_id: workflowId,
              workflow_name,
              workflow_type,
              target,
              steps_count: workflowSteps.length,
              status: 'executing'
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  private async coordinateSecurityAssessment(args: any): Promise<any> {
    const { target_url, assessment_scope, depth = 'standard' } = args;

    try {
      const assessmentPlan = {
        assessment_id: `sec-assess-${Date.now()}`,
        target_url,
        scope: assessment_scope,
        depth,
        started_at: new Date().toISOString(),
        tasks: [] as any[]
      };

      // Coordinate tasks based on scope
      for (const scopeItem of assessment_scope) {
        switch (scopeItem) {
          case 'web_vulnerabilities':
            const webScanResult = await this.clientManager.invokeToolOnClient(
              'bug_hunter',
              'vulnerability_scan',
              { target_url, scan_type: 'comprehensive' }
            );
            assessmentPlan.tasks.push({
              type: 'web_vulnerabilities',
              result: webScanResult,
              timestamp: new Date().toISOString()
            });
            break;

          case 'infrastructure':
            const infraResult = await this.clientManager.invokeToolOnClient(
              'rt_dev',
              'infrastructure_deployment',
              { target: target_url, deployment_type: 'analysis', duration: 60 }
            );
            assessmentPlan.tasks.push({
              type: 'infrastructure',
              result: infraResult,
              timestamp: new Date().toISOString()
            });
            break;

          case 'framework_analysis':
            const frameworkResult = await this.clientManager.invokeToolOnClient(
              'bug_hunter',
              'framework_detection',
              { target_url }
            );
            assessmentPlan.tasks.push({
              type: 'framework_analysis',
              result: frameworkResult,
              timestamp: new Date().toISOString()
            });
            break;

          case 'compliance':
            const complianceResult = await this.clientManager.invokeToolOnClient(
              'daedelu5',
              'compliance_check',
              { target: target_url, standards: ['owasp', 'nist'] }
            );
            assessmentPlan.tasks.push({
              type: 'compliance',
              result: complianceResult,
              timestamp: new Date().toISOString()
            });
            break;
        }
      }

      // Generate comprehensive report
      const reportResult = await this.clientManager.invokeToolOnClient(
        'bug_hunter',
        'security_analysis',
        {
          target_url,
          assessment_name: 'Security Assessment',
          report_format: 'json'
        }
      );

      assessmentPlan.tasks.push({
        type: 'final_report',
        result: reportResult,
        timestamp: new Date().toISOString()
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              assessment_plan: assessmentPlan,
              total_tasks: assessmentPlan.tasks.length,
              completion_time: new Date().toISOString()
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  private async manageInfrastructureDeployment(args: any): Promise<any> {
    const { deployment_name, services, coordination_config = {} } = args;

    try {
      const deploymentPlan = {
        deployment_id: `deploy-${Date.now()}`,
        deployment_name,
        services,
        started_at: new Date().toISOString(),
        results: [] as any[]
      };

      // Deploy services to appropriate systems
      for (const service of services) {
        const targetSystem = service.target_system === 'attack-node' ? 'rt_dev' : 
                           service.target_system === 'rtpi-pen' ? 'rt_dev' : 'rt_dev';
        
        const deployResult = await this.clientManager.invokeToolOnClient(
          targetSystem,
          'infrastructure_deployment',
          {
            service_name: service.name,
            image: service.image,
            deployment_type: 'service',
            config: service.configuration || {}
          }
        );

        deploymentPlan.results.push({
          service: service.name,
          target_system: targetSystem,
          result: deployResult,
          timestamp: new Date().toISOString()
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              deployment_plan: deploymentPlan,
              services_deployed: deploymentPlan.results.length,
              completion_time: new Date().toISOString()
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  private async orchestratePenetrationTest(args: any): Promise<any> {
    const { target, test_scope, test_methodology = 'owasp', reporting_requirements = {} } = args;

    try {
      const penTestPlan = {
        test_id: `pentest-${Date.now()}`,
        target,
        methodology: test_methodology,
        scope: test_scope,
        started_at: new Date().toISOString(),
        phases: [] as any[]
      };

      // Phase 1: Reconnaissance and Information Gathering
      if (test_scope.network_infrastructure) {
        const infraScanResult = await this.clientManager.invokeToolOnClient(
          'rt_dev',
          'infrastructure_deployment',
          { target: target, deployment_type: 'reconnaissance', duration: 120 }
        );
        
        penTestPlan.phases.push({
          phase: 'reconnaissance',
          type: 'infrastructure_scan',
          result: infraScanResult,
          timestamp: new Date().toISOString()
        });
      }

      // Phase 2: Vulnerability Discovery
      if (test_scope.web_application) {
        const webVulnResult = await this.clientManager.invokeToolOnClient(
          'bug_hunter',
          'vulnerability_scan',
          { target_url: target, scan_type: 'deep' }
        );
        
        penTestPlan.phases.push({
          phase: 'vulnerability_discovery',
          type: 'web_vulnerabilities',
          result: webVulnResult,
          timestamp: new Date().toISOString()
        });

        // Follow up with Burp Suite scan
        const burpResult = await this.clientManager.invokeToolOnClient(
          'burpsuite_operator',
          'web_scan',
          { target_url: target, scan_type: 'comprehensive' }
        );
        
        penTestPlan.phases.push({
          phase: 'vulnerability_discovery',
          type: 'burp_scan',
          result: burpResult,
          timestamp: new Date().toISOString()
        });
      }

      // Phase 3: Exploitation Setup
      const payloadResult = await this.clientManager.invokeToolOnClient(
        'rt_dev',
        'payload_creation',
        {
          target: target,
          payload_type: 'reverse_shell',
          format: 'php'
        }
      );
      
      penTestPlan.phases.push({
        phase: 'exploitation_setup',
        type: 'payload_generation',
        result: payloadResult,
        timestamp: new Date().toISOString()
      });

      // Phase 4: Advanced Testing
      const advancedTestResult = await this.clientManager.invokeToolOnClient(
        'daedelu5',
        'advanced_testing',
        {
          target: target,
          test_type: 'penetration',
          methodology: test_methodology
        }
      );
      
      penTestPlan.phases.push({
        phase: 'advanced_testing',
        type: 'penetration_testing',
        result: advancedTestResult,
        timestamp: new Date().toISOString()
      });

      // Phase 5: Reporting
      const reportResult = await this.clientManager.invokeToolOnClient(
        'bug_hunter',
        'security_analysis',
        {
          target_url: target,
          assessment_name: `Penetration Test - ${target}`,
          report_format: 'json'
        }
      );

      penTestPlan.phases.push({
        phase: 'reporting',
        type: 'comprehensive_report',
        result: reportResult,
        timestamp: new Date().toISOString()
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              penetration_test: penTestPlan,
              phases_completed: penTestPlan.phases.length,
              completion_time: new Date().toISOString()
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  private async syncAgentKnowledge(args: any): Promise<any> {
    const { knowledge_type, source_agents = [], target_agents = [] } = args;

    try {
      const syncOperation = {
        operation_id: `sync-${Date.now()}`,
        knowledge_type,
        source_agents,
        target_agents,
        started_at: new Date().toISOString(),
        synced_items: [] as any[]
      };

      // This would implement knowledge synchronization between agents
      // For now, return a successful operation structure
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              sync_operation: syncOperation,
              items_synced: syncOperation.synced_items.length
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  private async monitorSystemHealth(args: any): Promise<any> {
    const { monitoring_duration = 300, metrics = ['system_resources', 'service_health'], alert_thresholds = {} } = args;

    try {
      const monitoringSession = {
        session_id: `monitor-${Date.now()}`,
        duration: monitoring_duration,
        metrics,
        started_at: new Date().toISOString(),
        client_status: {} as any
      };

      // Get health status from all connected clients
      const allClients = this.clientManager.getAllClients();
      
      for (const client of allClients) {
        if (client.connected) {
          try {
            let healthData: any = {};
            
            // Get health data based on client type
            switch (client.id) {
              case 'bug_hunter':
                healthData = await this.clientManager.invokeToolOnClient(
                  'bug_hunter',
                  'security_analysis',
                  { target_url: 'health_check', health_mode: true }
                );
                break;
              case 'rt_dev':
                healthData = await this.clientManager.invokeToolOnClient(
                  'rt_dev',
                  'infrastructure_deployment',
                  { deployment_type: 'health_check', duration: 10 }
                );
                break;
              case 'burpsuite_operator':
                healthData = await this.clientManager.invokeToolOnClient(
                  'burpsuite_operator',
                  'web_scan',
                  { target_url: 'health_check', scan_type: 'ping' }
                );
                break;
              case 'daedelu5':
                healthData = await this.clientManager.invokeToolOnClient(
                  'daedelu5',
                  'compliance_check',
                  { target: 'health_check', audit_type: 'status' }
                );
                break;
              case 'nexus_kamuy':
                healthData = await this.clientManager.invokeToolOnClient(
                  'nexus_kamuy',
                  'workflow_orchestration',
                  { workflow_type: 'health_check' }
                );
                break;
              default:
                healthData = { status: 'healthy', client_type: client.type };
            }

            monitoringSession.client_status[client.id] = {
              connected: client.connected,
              last_health_check: client.lastHealthCheck,
              health_data: healthData,
              capabilities: client.capabilities,
              circuit_breaker_open: client.circuitBreakerOpen || false
            };

          } catch (error) {
            monitoringSession.client_status[client.id] = {
              connected: false,
              error: error instanceof Error ? error.message : String(error)
            };
          }
        } else {
          monitoringSession.client_status[client.id] = {
            connected: false,
            status: 'disconnected'
          };
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              monitoring_session: monitoringSession,
              clients_monitored: Object.keys(monitoringSession.client_status).length
            }, null, 2)
          }
        ]
      };

    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : String(error)
            }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  private async getClientsStatus(): Promise<any> {
    const clients = this.clientManager.getAllClients();
    const capabilities = await this.clientManager.getAggregatedCapabilities();
    
    return {
      contents: [
        {
          uri: 'nexus://clients/status',
          mimeType: 'application/json',
          text: JSON.stringify({
            timestamp: new Date().toISOString(),
            total_clients: clients.length,
            connected_clients: clients.filter(c => c.connected).length,
            clients,
            aggregated_capabilities: capabilities
          }, null, 2)
        }
      ]
    };
  }

  private async getActiveWorkflows(): Promise<any> {
    const activeWorkflows = Array.from(this.workflows.values());
    
    return {
      contents: [
        {
          uri: 'nexus://workflows/active',
          mimeType: 'application/json',
          text: JSON.stringify({
            timestamp: new Date().toISOString(),
            active_workflows: activeWorkflows.length,
            workflows: activeWorkflows
          }, null, 2)
        }
      ]
    };
  }

  private async getAggregatedCapabilities(): Promise<any> {
    const capabilities = await this.clientManager.getAggregatedCapabilities();
    
    return {
      contents: [
        {
          uri: 'nexus://capabilities/aggregated',
          mimeType: 'application/json',
          text: JSON.stringify({
            timestamp: new Date().toISOString(),
            capabilities,
            total_tools: Object.values(capabilities.tools).reduce((sum: number, tools: any) => sum + tools.length, 0),
            total_resources: Object.values(capabilities.resources).reduce((sum: number, resources: any) => sum + resources.length, 0)
          }, null, 2)
        }
      ]
    };
  }

  private async getServersStatus(): Promise<any> {
    const servers = this.serverManager.getAllServers();
    
    return {
      contents: [
        {
          uri: 'nexus://servers/status',
          mimeType: 'application/json',
          text: JSON.stringify({
            timestamp: new Date().toISOString(),
            total_servers: servers.length,
            running_servers: servers.filter(s => s.status === 'running').length,
            servers
          }, null, 2)
        }
      ]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MCP Nexus Orchestrator running on stdio');
  }
}

const nexusServer = new MCPNexusServer();
nexusServer.run().catch(console.error);
