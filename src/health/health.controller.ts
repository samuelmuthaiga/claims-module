import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ApiOkEnvelope } from '../common/decorators/api-response.decorator';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' }) status!: string;
  @ApiProperty({ example: 'backend-claims-service' }) service!: string;
  @ApiProperty({ example: 123.4 }) uptimeSeconds!: number;
}

@ApiTags('health')
@Controller('v1/health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkEnvelope('Service is healthy', HealthResponseDto)
  health(): HealthResponseDto {
    return { status: 'ok', service: process.env.SERVICE_NAME ?? 'backend-claims-service', uptimeSeconds: Math.round(process.uptime() * 10) / 10 };
  }
}
