import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Doctor } from '../../../doctor/entities/doctor.entity';
import { DoctorSchedule } from '../../../doctor/entities/doctor-schedule.entity';
import { TimeSlot } from '../../../doctor/entities/time-slot.entity';
import { Account } from '../../../account/entities/account.entity';
import { User } from '../../../user/entities/user.entity';
import { Patient } from '../../../patient/entities/patient.entity';
import { DoctorTitle } from 'src/modules/common/enums/doctor-title.enum';
import { Specialty as SpecialtyEnum } from 'src/modules/common/enums/specialty.enum';
import { RoleEnum } from '../../../common/enums/role.enum';
import { UserStatusEnum } from '../../../common/enums/user-status.enum';
import { ScheduleType } from 'src/modules/common/enums/schedule-type.enum';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';

/**
 * Consolidated Seed: Admin + Doctors + Schedules
 * Run: npx ts-node -r tsconfig-paths/register src/modules/core/database/seeds/seed.ts
 */

// ========== ADMIN DATA ==========
const adminData = {
  email: process.env.ADMIN_EMAIL || 'admin@telehealth.com',
  password: process.env.ADMIN_PASSWORD || 'Admin@123456',
  fullName: process.env.ADMIN_FULLNAME || 'System Administrator',
};

// ========== DOCTOR DATA ==========
const sampleDoctors = [
  {
    email: 'bs.nguyen@telehealth.vn',
    password: 'Doctor@123',
    fullName: 'BS. Nguyễn Văn Minh',
    phone: '0901234567',
    licenseNumber: 'GPHN-2020-001234',
    title: DoctorTitle.PHD_DOCTOR,
    position: 'Trưởng khoa',
    bio: 'Hơn 20 năm kinh nghiệm trong lĩnh vực Tim mạch. Tốt nghiệp chuyên khoa 2 tại ĐH Y Hà Nội.',
    practiceStartYear: 2004,
    yearsOfExperience: 20,
    specialtyName: SpecialtyEnum.PULMONOLOGY,
    defaultConsultationFee: '500000', // 500k - Senior
  },
  {
    email: 'bs.tran@telehealth.vn',
    password: 'Doctor@123',
    fullName: 'BS. Trần Thị Lan',
    phone: '0912345678',
    licenseNumber: 'GPHN-2018-005678',
    title: DoctorTitle.MASTER_DOCTOR,
    position: 'Phó khoa',
    bio: 'Chuyên gia Sản phụ khoa với 15 năm kinh nghiệm. Tốt nghiệp ĐH Y Dược TP.HCM.',
    practiceStartYear: 2009,
    yearsOfExperience: 15,
    specialtyName: SpecialtyEnum.THORACIC_SURGERY,
    defaultConsultationFee: '400000', // 400k
  },
  {
    email: 'bs.le@telehealth.vn',
    password: 'Doctor@123',
    fullName: 'BS. Lê Hoàng Nam',
    phone: '0923456789',
    licenseNumber: 'GPHN-2015-009012',
    title: DoctorTitle.ASSOCIATE_PROFESSOR_PHD_DOCTOR,
    position: 'Giám đốc trung tâm',
    bio: 'Chuyên gia đầu ngành về Ngoại thần kinh. Đào tạo tại Pháp và Mỹ.',
    practiceStartYear: 2000,
    yearsOfExperience: 24,
    specialtyName: SpecialtyEnum.PULMONOLOGY,
    defaultConsultationFee: '600000', // 600k - Most senior
  },
  {
    email: 'bs.pham@telehealth.vn',
    password: 'Doctor@123',
    fullName: 'BS. Phạm Minh Tuấn',
    phone: '0934567890',
    licenseNumber: 'GPHN-2019-003456',
    title: DoctorTitle.SPECIALIST_DOCTOR_1,
    position: 'Bác sĩ điều trị',
    bio: 'Bác sĩ Nhi khoa nhiệt tình, yêu trẻ em. 10 năm kinh nghiệm tại BV Nhi TƯ.',
    practiceStartYear: 2014,
    yearsOfExperience: 10,
    specialtyName: SpecialtyEnum.THORACIC_SURGERY,
    defaultConsultationFee: '300000', // 300k
  },
  {
    email: 'bs.hoang@telehealth.vn',
    password: 'Doctor@123',
    fullName: 'BS. Hoàng Thu Hà',
    phone: '0945678901',
    licenseNumber: 'GPHN-2017-007890',
    title: DoctorTitle.PHD_DOCTOR,
    position: 'Trưởng khoa',
    bio: 'Chuyên gia Da liễu thẩm mỹ hàng đầu. Đào tạo tại Hàn Quốc.',
    practiceStartYear: 2007,
    yearsOfExperience: 17,
    specialtyName: SpecialtyEnum.TUBERCULOSIS,
    defaultConsultationFee: '450000', // 450k
  },
];

// ========== SCHEDULE DATA ==========
// Lịch làm việc mẫu: Thứ 2 - Thứ 6, sáng 08:00-12:00, chiều 13:30-17:30
const scheduleTemplate = [
  // Buổi sáng: T2-T6 (dayOfWeek: 1-5)
  {
    dayOfWeek: 1,
    startTime: '08:00',
    endTime: '12:00',
    breakStartTime: null,
    breakEndTime: null,
  },
  {
    dayOfWeek: 2,
    startTime: '08:00',
    endTime: '12:00',
    breakStartTime: null,
    breakEndTime: null,
  },
  {
    dayOfWeek: 3,
    startTime: '08:00',
    endTime: '12:00',
    breakStartTime: null,
    breakEndTime: null,
  },
  {
    dayOfWeek: 4,
    startTime: '08:00',
    endTime: '12:00',
    breakStartTime: null,
    breakEndTime: null,
  },
  {
    dayOfWeek: 5,
    startTime: '08:00',
    endTime: '12:00',
    breakStartTime: null,
    breakEndTime: null,
  },
  // Buổi chiều: T2-T6
  {
    dayOfWeek: 1,
    startTime: '13:30',
    endTime: '17:30',
    breakStartTime: null,
    breakEndTime: null,
  },
  {
    dayOfWeek: 2,
    startTime: '13:30',
    endTime: '17:30',
    breakStartTime: null,
    breakEndTime: null,
  },
  {
    dayOfWeek: 3,
    startTime: '13:30',
    endTime: '17:30',
    breakStartTime: null,
    breakEndTime: null,
  },
  {
    dayOfWeek: 4,
    startTime: '13:30',
    endTime: '17:30',
    breakStartTime: null,
    breakEndTime: null,
  },
  {
    dayOfWeek: 5,
    startTime: '13:30',
    endTime: '17:30',
    breakStartTime: null,
    breakEndTime: null,
  },
];

async function seed() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config();

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DB_URL,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [Doctor, DoctorSchedule, TimeSlot, Account, User, Patient],
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    synchronize: true, // Sync schema before seeding
  });

  try {
    await dataSource.initialize();
    console.log('🔗 Database connected');

    const doctorRepo = dataSource.getRepository(Doctor);
    const scheduleRepo = dataSource.getRepository(DoctorSchedule);
    const accountRepo = dataSource.getRepository(Account);
    const userRepo = dataSource.getRepository(User);

    // ========== SEED ADMIN ==========
    console.log('\n👤 Seeding Admin...');
    const existingAdmin = await accountRepo.findOne({
      where: { email: adminData.email.toLowerCase() },
    });

    if (existingAdmin) {
      console.log(`  ⚠️ Admin exists: ${adminData.email}`);
    } else {
      const adminUser = userRepo.create({
        fullName: adminData.fullName,
        status: UserStatusEnum.ACTIVE,
      });
      await userRepo.save(adminUser);

      const hashedAdminPassword = await bcrypt.hash(adminData.password, 12);
      const adminAccount = accountRepo.create({
        email: adminData.email.toLowerCase(),
        password: hashedAdminPassword,
        roles: [RoleEnum.ADMIN],
        isVerified: true,
        verifiedAt: new Date(),
        userId: adminUser.id,
      });
      await accountRepo.save(adminAccount);
      console.log(`  ✅ Admin created: ${adminData.email}`);
    }

    // ========== SEED DOCTORS ==========
    console.log('\n👨‍⚕️ Seeding Doctors...');
    const createdDoctors: Doctor[] = [];

    for (const docData of sampleDoctors) {
      // Check existing by email
      const existingAccount = await accountRepo.findOne({
        where: { email: docData.email.toLowerCase() },
      });

      if (existingAccount) {
        console.log(`  ⚠️ Doctor exists (email): ${docData.email}`);
        // Find existing doctor for schedule seeding
        const existingDoctor = await doctorRepo.findOne({
          where: { userId: existingAccount.userId },
        });
        if (existingDoctor) {
          createdDoctors.push(existingDoctor);
        }
        continue;
      }

      // Check existing by phone
      const existingUserByPhone = await userRepo.findOne({
        where: { phone: docData.phone },
      });

      if (existingUserByPhone) {
        console.log(`  ⚠️ User exists (phone): ${docData.phone}`);
        // Find existing doctor for schedule seeding
        const existingDoctor = await doctorRepo.findOne({
          where: { userId: existingUserByPhone.id },
        });
        if (existingDoctor) {
          createdDoctors.push(existingDoctor);
        }
        continue;
      }

      // Create User
      const user = userRepo.create({
        fullName: docData.fullName,
        phone: docData.phone,
        status: UserStatusEnum.ACTIVE,
      });
      await userRepo.save(user);

      // Create Account
      const hashedPassword = await bcrypt.hash(docData.password, 12);
      const account = accountRepo.create({
        email: docData.email.toLowerCase(),
        password: hashedPassword,
        roles: [RoleEnum.DOCTOR],
        isVerified: true,
        verifiedAt: new Date(),
        userId: user.id,
      });
      await accountRepo.save(account);

      // Create Doctor
      const doctor = doctorRepo.create({
        userId: user.id,
        licenseNumber: docData.licenseNumber,
        title: docData.title,
        position: docData.position,
        bio: docData.bio,
        practiceStartYear: docData.practiceStartYear,
        yearsOfExperience: docData.yearsOfExperience,
        specialty: docData.specialtyName as unknown as SpecialtyEnum,
        defaultConsultationFee: docData.defaultConsultationFee,
      });
      await doctorRepo.save(doctor);
      createdDoctors.push(doctor);

      console.log(`  ✅ Created: ${docData.fullName} (${docData.email})`);
    }

    // ========== SEED DOCTOR SCHEDULES ==========
    console.log('\n📅 Seeding Doctor Schedules...');

    // Get tomorrow's date as effectiveFrom
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    let schedulesCreated = 0;

    for (const doctor of createdDoctors) {
      // Check if doctor already has schedules
      const existingSchedules = await scheduleRepo.find({
        where: { doctorId: doctor.id },
      });

      if (existingSchedules.length > 0) {
        console.log(`  ⚠️ Schedules exist for doctor: ${doctor.id}`);
        continue;
      }

      // Create schedules for this doctor
      for (const template of scheduleTemplate) {
        const schedule = scheduleRepo.create({
          doctorId: doctor.id,
          dayOfWeek: template.dayOfWeek,
          startTime: template.startTime,
          endTime: template.endTime,
          slotDuration: 30, // 30 phút/slot
          slotCapacity: 1, // 1 bệnh nhân/slot
          appointmentType: AppointmentTypeEnum.VIDEO,
          scheduleType: ScheduleType.REGULAR,
          priority: 0,
          isAvailable: true,
          effectiveFrom: tomorrow,
          effectiveUntil: null, // Vô thời hạn
          minimumBookingTime: 60, // Đặt trước 60 phút
          maxAdvanceBookingDays: 30, // Đặt trước tối đa 30 ngày
          consultationFee: '300000', // 300,000 VND
        });
        await scheduleRepo.save(schedule);
        schedulesCreated++;
      }

      console.log(`  ✅ Created 10 schedules for doctor: ${doctor.id}`);
    }

    // ========== SUMMARY ==========
    console.log('\n🎉 Seed completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👤 Admin: 1`);
    console.log(`👨‍⚕️ Doctors: ${sampleDoctors.length}`);
    console.log(`📅 Schedules created: ${schedulesCreated}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📧 Admin login: admin@telehealth.com / Admin@123456');
    console.log('📧 Doctor login: bs.nguyen@telehealth.vn / Doctor@123');
    console.log('');

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

seed();
