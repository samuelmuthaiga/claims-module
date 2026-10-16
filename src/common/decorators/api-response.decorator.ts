import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, ApiResponse } from '@nestjs/swagger';
import { ApiErrorResponseWrapper, ApiResponseWrapper } from '../swagger/swagger.models';

/** Documents a success response wrapped in the Autochek envelope. */
export const ApiOkEnvelope = (
  description: string,
  model?: Type<unknown>,
  isArray = false,
): MethodDecorator => {
  const dataSchema = model
    ? isArray
      ? { type: 'array', items: { $ref: `#/components/schemas/${model.name}` } }
      : { $ref: `#/components/schemas/${model.name}` }
    : { type: 'object' };
  return applyDecorators(
    ApiExtraModels(ApiResponseWrapper, ...(model ? [model] : [])),
    ApiOkResponse({
      description,
      schema: {
        allOf: [
          { $ref: '#/components/schemas/ApiResponseWrapper' },
          { properties: { data: dataSchema } },
        ],
      },
    }),
  );
};

export const ApiErrorResponse = (status: HttpStatus, description: string): MethodDecorator =>
  applyDecorators(
    ApiExtraModels(ApiErrorResponseWrapper),
    ApiResponse({
      status,
      description,
      schema: { $ref: '#/components/schemas/ApiErrorResponseWrapper' },
    }),
  );
