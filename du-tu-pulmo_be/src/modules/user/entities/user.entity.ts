import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
  Index,
  BeforeInsert,
} from 'typeorm';
import { Account } from 'src/modules/account/entities/account.entity';
import { UserStatusEnum } from '../../common/enums/user-status.enum';
import { GenderEnum } from 'src/modules/common/enums/gender.enum';
import { Patient } from 'src/modules/patient/entities/patient.entity';
import { Doctor } from 'src/modules/doctor/entities/doctor.entity';

@Entity('users')
@Index(['status'])
@Index(['phone'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

@Column({ length: 20, nullable: true, unique: true })
  phone: string;

  @Column({ name: 'full_name', length: 100 })
  fullName: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({
    type: 'enum',
    enum: UserStatusEnum,
    default: UserStatusEnum.ACTIVE,
  })
  status: UserStatusEnum; // Profile/Business status

  // Địa chỉ
  @Column({ length: 20, nullable: true })
  provinceCode: string;

  @Column({ length: 100, nullable: true })
  province: string; // Tỉnh/Thành phố

  @Column({ length: 20, nullable: true })
  wardCode: string;

  @Column({ length: 100, nullable: true })
  ward: string; //  Phường/Xã

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true, unique: true, length: 20 })
  CCCD?: string;

  @Column({
    type: 'enum',
    enum: GenderEnum,
    nullable: true,
  })
  gender: GenderEnum;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamptz',
    nullable: true,
  })
  deletedAt: Date;

  @OneToOne(() => Account, (account) => account.user)
  account: Account;

  @OneToOne(() => Patient, (patient) => patient.user, { nullable: true })
  patient: Patient | null;

  @OneToOne(() => Doctor, (doctor) => doctor.user, { nullable: true })
  doctor: Doctor | null;

  @BeforeInsert()
  beforeInsert() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.avatarUrl = this.avatarUrl || this.generateDefaultAvatarUrl();
  }

  private generateDefaultAvatarUrl(): string {
    const firstChar = this.fullName ? this.fullName.charAt(0).toUpperCase() : 'A';
    const width = 150;
    const height = 150;
    const format = 'png';

    const lightColors = [
      'F0F8FF', 'FAEBD7', 'F5F5DC', 'FFFACD', 'FAF0E6',
      'FFE4C4', 'FFDAB9', 'EEE8AA', 'F0FFF0', 'F5FFFA',
      'F0FFFF', 'F8F8FF', 'F5F5F5', 'FFFFE0', 'FFFFF0',
      'FFFAFA', '7FFFD4', 'ADD8E6', 'B0E0E6', 'AFEEEE',
      'E0FFFF', '87CEFA', 'B0C4DE', 'D3D3D3', '98FB98',
      'F5F5DC', 'FAF0E6', 'FFF8DC', 'FFEBCD', 'FFF5EE',
    ];
    const darkColors = [
      '8B0000', 'A0522D', '800000', '8B4513', '4682B4',
      '00008B', '191970', '008080', '006400', '556B2F',
      '808000', '8B8682', '2F4F4F', '000000', '228B22',
      '3CB371', '2E8B57', '483D8B', '6A5ACD', '7B68EE',
      '4169E1', '6495ED', '00CED1', '40E0D0', '008B8B',
    ];

    const allColors = [...lightColors, ...darkColors];
    const randomIndex = Math.floor(Math.random() * allColors.length);
    const backgroundColor = allColors[randomIndex];

    const getRelativeLuminance = (hexColor) => {
      const r = parseInt(hexColor.slice(0, 2), 16) / 255;
      const g = parseInt(hexColor.slice(2, 4), 16) / 255;
      const b = parseInt(hexColor.slice(4, 6), 16) / 255;
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const luminance = getRelativeLuminance(backgroundColor);
    const textColor = luminance > 0.5 ? '000000' : 'ffffff';

    return `https://placehold.jp/70/${backgroundColor}/${textColor}/${width}x${height}.${format}?text=${firstChar}&css=%7B%22font-weight%22%3A%22%20bold%22%7D`;
  }
}