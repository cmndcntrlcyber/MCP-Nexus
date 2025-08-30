# MCP-Nexus Bridge Repair Guide

This guide documents the comprehensive repair of the MCP-Nexus agent communication system to work with the OpenWebUI bridge at https://chat.attck.nexus/.

## Problem Analysis

### Root Cause
The MCP-Nexus was originally configured to connect to local MCP servers at `localhost:3001` and `localhost:3002`, but the actual agents are available through an OpenWebUI bridge at `https://offsec-team.attck-community.workers.dev`.

### Key Issues Identified
1. **Wrong Endpoints**: Connecting to localhost instead of bridge URLs
2. **Wrong Protocol**: Using MCP SDK instead of REST API calls
3. **Wrong Agent Names**: Using `attack-node`/`rtpi-pen` instead of bridge agent names
4. **Wrong Payload Format**: MCP messages instead of bridge-compatible JSON

## Solution Overview

### Bridge Architecture
The repair implements a new `BridgeClientManager` that communicates with the OpenWebUI bridge using:
- **Primary Endpoint**: `https://offsec-team.attck-community.workers.dev/execute`
- **Protocol**: HTTP REST API with JSON payloads
- **Authentication**: Bearer token and API key support
- **Error Handling**: Circuit breaker pattern, retry logic, rate limiting

### Agent Mapping
| Old Agent | New Agent | Capabilities |
|-----------|-----------|-------------|
| `attack-node` | `bug_hunter` | vulnerability_scan, framework_detection, security_analysis |
| `attack-node` | `burpsuite_operator` | web_scan, proxy_analysis, payload_testing |
| `rtpi-pen` | `rt_dev` | code_generation, infrastructure_deployment, payload_creation |
| N/A | `daedelu5` | compliance_check, audit_analysis, advanced_testing |
| N/A | `nexus_kamuy` | workflow_orchestration, task_coordination, agent_management |

## Implementation Details

### New Bridge Client Manager
- **File**: `server/mcp/BridgeClientManager.ts`
- **Features**: 
  - REST API communication
  - Circuit breaker pattern
  - Automatic retry with exponential backoff
  - Health monitoring
  - Request/response validation

### Updated Workflows
All workflow implementations have been updated to use the new bridge agents:
- **Security Assessment**: `bug_hunter` + `burpsuite_operator`
- **Penetration Testing**: `rt_dev` + `burpsuite_operator` + `daedelu5`
- **Compliance Audit**: `daedelu5` + `bug_hunter`
- **Infrastructure Scan**: `rt_dev` + `nexus_kamuy`

### Environment Configuration
- **File**: `.env.bridge`
- **Key Variables**:
  - `OFFSEC_API_URL`: Primary bridge endpoint
  - `BRIDGE_BEARER_TOKEN`: Authentication token
  - `BRIDGE_API_KEY`: API key for additional auth
  - Various timeout and retry settings

## Configuration Setup

### 1. Environment Variables
Copy `.env.bridge` to `.env` and configure:

```bash
cp .env.bridge .env
# Edit .env with your actual credentials:
BRIDGE_BEARER_TOKEN=your_actual_bearer_token_here
BRIDGE_API_KEY=your_actual_api_key_here
```

### 2. Authentication
Obtain credentials from the bridge administrator:
- Bearer token for API authentication
- API key for additional security
- Ensure your IP/domain is allowlisted if required

### 3. Testing Connection
Use the provided test script to validate connectivity:

```bash
npm run test:bridge
```

## API Integration

### Bridge Payload Format
The bridge expects payloads in this format:
```json
{
  "tool_name": "vulnerability_scan",
  "agent": "bug_hunter",
  "parameters": {
    "target_url": "https://example.com",
    "scan_type": "comprehensive",
    "context": {
      "correlation_id": "unique_request_id",
      "agent_type": "bug_hunter",
      "user_id": "mcp_nexus_system"
    }
  },
  "request_id": "correlation_id_here"
}
```

### Response Format
The bridge returns responses like:
```json
{
  "success": true,
  "result": {
    // Tool execution results
  },
  "execution_time_ms": 1500,
  "agent": "bug_hunter",
  "capability": "vulnerability_scan",
  "endpoint_source": "offsec_team"
}
```

## Error Handling

### Circuit Breaker
- Opens after 5 consecutive failures
- Timeout: 60 seconds
- Automatically resets on successful request

### Retry Logic
- Maximum 3 retries per request
- Exponential backoff: 1s, 2s, 4s
- Special handling for rate limiting (429 errors)

### Health Monitoring
- Periodic health checks every 30 seconds
- Automatic reconnection attempts
- Circuit breaker integration

## Monitoring and Debugging

### Health Endpoints
- Client status: `nexus://clients/status`
- Workflow status: `nexus://workflows/active`
- Aggregated capabilities: `nexus://capabilities/aggregated`

### Debug Mode
Enable debug logging by setting:
```bash
BRIDGE_DEBUG_MODE=true
BRIDGE_LOG_LEVEL=debug
```

### Metrics Collection
When enabled, the system collects:
- Request/response times
- Success/failure rates
- Circuit breaker status
- Agent availability

## Testing and Validation

### Basic Connectivity Test
```bash
# Test all agents
node scripts/test-bridge-connectivity.js

# Test specific agent
node scripts/test-bridge-connectivity.js bug_hunter
```

### Workflow Testing
```bash
# Test security assessment workflow
node scripts/test-workflow.js security_assessment https://example.com

# Test penetration test workflow
node scripts/test-workflow.js penetration_test https://testsite.com
```

### Health Check
```bash
# Check system health
curl -X GET http://localhost:5000/api/health

# Check bridge status
curl -X GET http://localhost:5000/api/bridge/status
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify `BRIDGE_BEARER_TOKEN` and `BRIDGE_API_KEY`
   - Check token expiration
   - Ensure proper URL encoding

2. **Connection Timeouts**
   - Increase `BRIDGE_REQUEST_TIMEOUT`
   - Check network connectivity to bridge
   - Verify firewall settings

3. **Rate Limiting**
   - Reduce concurrent requests
   - Implement request queuing
   - Contact bridge admin for limits increase

4. **Agent Unavailable**
   - Check bridge agent status
   - Verify agent names match bridge configuration
   - Try alternative agents for capabilities

### Debugging Steps

1. Enable debug logging
2. Check bridge endpoint accessibility
3. Validate payload format
4. Test with minimal parameters
5. Monitor network traffic
6. Check bridge logs (if accessible)

## Migration Notes

### Breaking Changes
- Agent names completely changed
- API calls now use REST instead of MCP protocol
- Workflow step definitions updated
- Environment variable names changed

### Backward Compatibility
- Old MCP server manager kept for local servers
- Gradual migration possible
- Fallback mechanisms in place

### Performance Impact
- Reduced latency (direct HTTP vs MCP overhead)
- Better error handling and recovery
- Improved monitoring and debugging

## Security Considerations

### Authentication
- Bearer tokens should be rotated regularly
- API keys should be kept secure
- Use environment variables, never hardcode

### Network Security
- All communication over HTTPS
- Request/response validation enabled
- Circuit breaker prevents DoS scenarios

### Data Protection
- Sanitize sensitive data in logs
- Limit request/response sizes
- Implement proper timeout handling

## Future Improvements

### Planned Enhancements
1. **Load Balancing**: Multiple bridge endpoints
2. **Caching**: Response caching for repeated requests
3. **Metrics Dashboard**: Real-time monitoring UI
4. **Batch Operations**: Multiple agent calls in single request
5. **Streaming**: Real-time results for long-running operations

### Monitoring Improvements
1. **Alerting**: Slack/email notifications
2. **Dashboards**: Grafana integration
3. **Log Analysis**: ELK stack integration
4. **Performance Profiling**: APM tools

## Support

For issues and questions:
1. Check this documentation
2. Review logs with debug mode enabled
3. Test connectivity with provided scripts
4. Contact the bridge administrator
5. Submit issues via GitHub

## Changelog

### Version 2.0.0 (Bridge Integration)
- Complete rewrite of client communication layer
- Added OpenWebUI bridge support
- Implemented circuit breaker pattern
- Added comprehensive error handling
- Updated all workflows for new agents
- Added extensive monitoring and debugging

### Previous Versions
- 1.x: Original MCP SDK implementation (deprecated)
