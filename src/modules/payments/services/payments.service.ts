import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentSummaryResponseDto, PaymentQuoteResponseDto, PaymentRequestDto, PaymentActionDto } from '../dto/payment.dto';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @Optional() @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
  ) {}

  private mockPaymentQuotes: PaymentQuoteResponseDto[] = [
    {
      id: 1,
      claimId: 1024,
      quoteId: 31,
      amount: 450000,
      currency: 'NGN',
      status: 'PENDING',
      createdAt: '2026-10-05T10:00:00.000Z',
    },
    {
      id: 2,
      claimId: 1023,
      quoteId: 30,
      amount: 320000,
      currency: 'NGN',
      status: 'APPROVED',
      createdAt: '2026-10-04T09:00:00.000Z',
    },
  ];

  async getSummary(): Promise<PaymentSummaryResponseDto> {
    try {
      const pending = await this.paymentRepository.count({ where: { status: 'PENDING' } });
      const approved = await this.paymentRepository.count({ where: { status: 'APPROVED' } });
      const paid = await this.paymentRepository.count({ where: { status: 'PAID' } });
      const totalAmount = await this.paymentRepository
        .createQueryBuilder('payment')
        .select('SUM(payment.amount)', 'total')
        .getRawOne();

      return {
        pending,
        approved,
        paid,
        totalAmount: parseFloat(totalAmount?.total || '0'),
        currency: 'NGN',
      };
    } catch (error) {
      const pending = this.mockPaymentQuotes.filter((p) => p.status === 'PENDING').length;
      const approved = this.mockPaymentQuotes.filter((p) => p.status === 'APPROVED').length;
      const paid = this.mockPaymentQuotes.filter((p) => p.status === 'PAID').length;
      const totalAmount = this.mockPaymentQuotes.reduce((sum, p) => sum + p.amount, 0);
      return {
        pending,
        approved,
        paid,
        totalAmount,
        currency: 'NGN',
      };
    }
  }

  async getQuotes(page: number = 1, limit: number = 10): Promise<{ data: PaymentQuoteResponseDto[]; meta: any }> {
    try {
      const [payments, total] = await this.paymentRepository.findAndCount({
        skip: (page - 1) * limit,
        take: limit,
        order: { createdAt: 'DESC' },
      });

      return {
        data: payments.map(p => this.mapEntityToDto(p)),
        meta: { total, page, limit },
      };
    } catch (error) {
      const start = (page - 1) * limit;
      const end = start + limit;
      const data = this.mockPaymentQuotes.slice(start, end);
      return {
        data,
        meta: {
          total: this.mockPaymentQuotes.length,
          page,
          limit,
        },
      };
    }
  }

  async requestPayment(requestDto: PaymentRequestDto): Promise<PaymentQuoteResponseDto> {
    try {
      const payment = this.paymentRepository.create({
        claimId: 1024,
        amount: requestDto.amount,
        currency: requestDto.currency,
        status: 'PENDING',
        requestedBy: 'system',
        createdBy: 'system',
        updatedBy: 'system',
      });
      const saved = await this.paymentRepository.save(payment);
      return this.mapEntityToDto(saved);
    } catch (error) {
      const newPayment: PaymentQuoteResponseDto = {
        id: this.mockPaymentQuotes.length + 1,
        claimId: 1024,
        quoteId: 31,
        amount: requestDto.amount,
        currency: requestDto.currency,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
      this.mockPaymentQuotes.push(newPayment);
      return newPayment;
    }
  }

  async actionPayment(id: number, actionDto: PaymentActionDto): Promise<PaymentQuoteResponseDto> {
    try {
      const payment = await this.paymentRepository.findOne({ where: { id } });
      if (!payment) {
        throw new Error('Payment not found');
      }
      payment.status = actionDto.action;
      if (actionDto.action === 'APPROVED') {
        payment.approvedBy = 'user-201';
        payment.approvedAt = new Date();
      }
      const saved = await this.paymentRepository.save(payment);
      return this.mapEntityToDto(saved);
    } catch (error) {
      const payment = this.mockPaymentQuotes.find((p) => p.id === id);
      if (!payment) {
        throw new Error('Payment not found');
      }
      payment.status = actionDto.action;
      return payment;
    }
  }

  private mapEntityToDto(payment: Payment): PaymentQuoteResponseDto {
    return {
      id: payment.id,
      claimId: payment.claimId,
      quoteId: payment.quoteId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      createdAt: payment.createdAt?.toISOString(),
    };
  }
}
