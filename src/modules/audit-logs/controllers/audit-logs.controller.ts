import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '../../../auth/constants/permissions';
import { RequirePermissions } from '../../../auth/decorators/require-permissions.decorator';
import { ApiAuth } from '../../../common/decorators/api-auth.decorator';
import { ApiOkEnvelope } from '../../../common/decorators/api-response.decorator';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import { AuditLogsService } from '../services/audit-logs.service';

@ApiTags('audit-logs')
@ApiAuth()
@RequirePermissions(Permission.AUDIT_READ)
@Controller('v1/audit-logs')
export class AuditLogsController {
  constructor(private readonly service: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs (newest first)' })
  @ApiOkEnvelope('Paginated audit log entries')
  list(@Query() query: AuditLogQueryDto) {
    return this.service.list(query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Audit event counts by module, action and severity' })
  @ApiOkEnvelope('Audit summary')
  summary() {
    return this.service.summary();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one audit log entry with before/after state and chain hash' })
  @ApiOkEnvelope('Audit log detail')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }
}
