import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  GoodsType,
  ProductCategory,
  MedicineGroup,
  RouteOfAdministration,
  UnitOfMeasure,
} from '@/modules/medical/enums/medicine.enums';

@Entity('medicines')
export class Medicine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'registration_number', length: 50, nullable: true })
  registrationNumber: string;

  @Column({ name: 'active_ingredient', type: 'text', nullable: true })
  activeIngredient: string;

  @Column({ length: 100, nullable: true })
  content: string;

  @Column({
    name: 'goods_type',
    type: 'enum',
    enum: GoodsType,
    default: GoodsType.MEDICINE,
  })
  goodsType: GoodsType;

  @Column({
    type: 'enum',
    enum: ProductCategory,
    nullable: true,
  })
  category: ProductCategory;

  @Column({
    type: 'enum',
    enum: MedicineGroup,
    nullable: true,
  })
  group: MedicineGroup;

  @Column({
    type: 'enum',
    enum: RouteOfAdministration,
    nullable: true,
  })
  route: RouteOfAdministration;

  @Column({
    type: 'enum',
    enum: UnitOfMeasure,
    default: UnitOfMeasure.TABLET,
  })
  unit: UnitOfMeasure;

  @Column({ length: 255, nullable: true })
  packing: string;

  @Column({ length: 150, nullable: true })
  manufacturer: string;

  @Column({ name: 'country_of_origin', length: 100, nullable: true })
  countryOfOrigin: string;

  @Column({ type: 'text', nullable: true })
  guide: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  status: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
