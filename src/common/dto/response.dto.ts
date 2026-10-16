export class ResponseMetaDto {
  total!: number;
  page!: number;
  limit!: number;
}

export class ResponseDto<T> {
  data!: T;
  meta?: ResponseMetaDto;
}
