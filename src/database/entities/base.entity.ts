import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
} from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'created_by', length: 64, nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', length: 64, nullable: true })
  updatedBy!: string | null;

  @Column({ default: 1 })
  version!: number;
}
