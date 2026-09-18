import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { Prisma } from '@prisma/client'

/**
 * Prisma errors that mean "the client sent something we cannot act on", mapped
 * to the status a hand-written check would have produced. Every other Prisma
 * error (connection, constraint on a server-generated value, ...) stays a 500
 * and is logged with its stack; its text never reaches the client.
 *
 *  P2023  inconsistent column data — e.g. a non-UUID string in a uuid column
 *  P2025  the record an update/delete targeted does not exist
 *  P2003  a foreign key in the input points at a row that does not exist
 */
function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): { status: number; message: string } | null {
  switch (err.code) {
    case 'P2023': return { status: HttpStatus.BAD_REQUEST, message: 'Invalid identifier' }
    case 'P2025': return { status: HttpStatus.NOT_FOUND, message: 'Not found' }
    case 'P2003': return { status: HttpStatus.BAD_REQUEST, message: 'Related record not found' }
    default: return null
  }
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const mapped =
      exception instanceof Prisma.PrismaClientKnownRequestError ? mapPrismaError(exception) : null

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : mapped?.status ?? HttpStatus.INTERNAL_SERVER_ERROR

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any)?.message ?? exception.message
        : mapped?.message ?? 'Internal server error'

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception))
    }

    response.status(status).json({
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    })
  }
}
