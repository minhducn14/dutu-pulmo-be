import { Type, applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ResponseCommon } from '../dto/response.dto';

export const ApiOkResponseCommon = <TModel extends Type<unknown>>(
  model: TModel,
) =>
  applyDecorators(
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ResponseCommon) },
          {
            properties: {
              data: { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );

export const ApiCreatedResponseCommon = <TModel extends Type<unknown>>(
  model: TModel,
) =>
  applyDecorators(
    ApiCreatedResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(ResponseCommon) },
          {
            properties: {
              data: { $ref: getSchemaPath(model) },
            },
          },
        ],
      },
    }),
  );
