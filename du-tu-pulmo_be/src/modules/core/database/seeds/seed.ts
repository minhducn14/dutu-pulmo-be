import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Doctor } from '../../../doctor/entities/doctor.entity';
import { DoctorSchedule } from '../../../doctor/entities/doctor-schedule.entity';
import { TimeSlot } from '../../../doctor/entities/time-slot.entity';
import { Account } from '../../../account/entities/account.entity';
import { User } from '../../../user/entities/user.entity';
import { Patient } from '../../../patient/entities/patient.entity';
import { Hospital } from '../../../hospital/entities/hospital.entity';
import { DoctorTitle } from 'src/modules/common/enums/doctor-title.enum';
import { Specialty as SpecialtyEnum } from 'src/modules/common/enums/specialty.enum';
import { RoleEnum } from '../../../common/enums/role.enum';
import { UserStatusEnum } from '../../../common/enums/user-status.enum';
import { ScheduleType } from 'src/modules/common/enums/schedule-type.enum';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';

/**
 * Seed data cho hệ thống phòng khám phổi Dutu Pulmo
 * Chuyên khoa: Hô hấp, Phẫu thuật lồng ngực, Nội khoa hô hấp, Lao phổi
 * Run: npx ts-node -r tsconfig-paths/register src/modules/core/database/seeds/seed.ts
 */

// ========== ADMIN DATA ==========
const adminData = {
  email: process.env.ADMIN_EMAIL || 'admin@dutupulmo.vn',
  password: process.env.ADMIN_PASSWORD || 'Admin@123456',
  fullName: process.env.ADMIN_FULLNAME || 'Quản trị viên Dutu Pulmo',
};

// ========== HOSPITAL DATA ==========
const sampleHospitals = [
  {
    name: 'Bệnh viện Phổi Trung ương',
    hospitalCode: 'BVPTW',
    phone: '024.3835.2512',
    email: 'contact@bvphoitrunguong.vn',
    address: '463 Hoàng Hoa Thám, Tây Hồ, Hà Nội',
    latitude: 21.0556,
    longitude: 105.8145,
  },
  {
    name: 'Bệnh viện Phổi TP. Hồ Chí Minh',
    hospitalCode: 'BVPHCM',
    phone: '028.3855.0275',
    email: 'contact@bvphoihcm.vn',
    address: '587 Huỳnh Văn Bánh, Phú Nhuận, TP.HCM',
    latitude: 10.7985,
    longitude: 106.6736,
  },
  {
    name: 'Bệnh viện Lao và Bệnh phổi Cần Thơ',
    hospitalCode: 'BVLBPCT',
    phone: '0292.3831.100',
    email: 'contact@bvlaophoicantho.vn',
    address: '89 Trần Hưng Đạo, Ninh Kiều, Cần Thơ',
    latitude: 10.0346,
    longitude: 105.7676,
  },
];

// ========== DOCTOR DATA - CHUYÊN KHOA PHỔI ==========
const sampleDoctors = [
  // PULMONOLOGY - Hô hấp
  {
    email: 'bs.nguyenvanphoi@dutupulmo.vn',
    password: 'Doctor@123',
    fullName: 'GS.TS.BS. Nguyễn Văn Phổi',
    phone: '0901234567',
    licenseNumber: 'GPHN-2005-001234',
    title: DoctorTitle.PROFESSOR_PHD_DOCTOR,
    position: 'Giám đốc Bệnh viện',
    bio: 'Hơn 30 năm kinh nghiệm trong lĩnh vực Hô hấp. Nguyên Giám đốc Bệnh viện Phổi Trung ương. Chuyên gia hàng đầu về bệnh phổi tắc nghẽn mạn tính (COPD) và hen suyễn. Đào tạo tại Pháp và Hoa Kỳ.',
    practiceStartYear: 1994,
    yearsOfExperience: 30,
    specialtyName: SpecialtyEnum.PULMONOLOGY,
    defaultConsultationFee: '800000',
    hospitalIndex: 0, // Bệnh viện Phổi Trung ương
  },
  {
    email: 'bs.tranhoangcopd@dutupulmo.vn',
    password: 'Doctor@123',
    fullName: 'PGS.TS.BS. Trần Hoàng Hô Hấp',
    phone: '0912345678',
    licenseNumber: 'GPHN-2008-005678',
    title: DoctorTitle.ASSOCIATE_PROFESSOR_PHD_DOCTOR,
    position: 'Trưởng khoa Hô hấp',
    bio: 'Chuyên gia về bệnh lý hô hấp mạn tính, nội soi phế quản chẩn đoán và điều trị. 20 năm kinh nghiệm điều trị COPD, hen phế quản, và các bệnh phổi kẽ. Tốt nghiệp Tiến sĩ Y khoa tại ĐH Y Hà Nội.',
    practiceStartYear: 2004,
    yearsOfExperience: 20,
    specialtyName: SpecialtyEnum.PULMONOLOGY,
    defaultConsultationFee: '600000',
    hospitalIndex: 0,
  },
  {
    email: 'bs.levanasthma@dutupulmo.vn',
    password: 'Doctor@123',
    fullName: 'TS.BS. Lê Văn Hen',
    phone: '0923456789',
    licenseNumber: 'GPHN-2012-009012',
    title: DoctorTitle.PHD_DOCTOR,
    position: 'Phó khoa Hô hấp',
    bio: 'Chuyên gia hen phế quản và dị ứng hô hấp. 12 năm kinh nghiệm trong chẩn đoán và điều trị các bệnh dị ứng đường hô hấp. Thành viên Hội Hô hấp Việt Nam.',
    practiceStartYear: 2012,
    yearsOfExperience: 12,
    specialtyName: SpecialtyEnum.PULMONOLOGY,
    defaultConsultationFee: '450000',
    hospitalIndex: 1, // Bệnh viện Phổi TP.HCM
  },
  // THORACIC_SURGERY - Phẫu thuật lồng ngực
  {
    email: 'bs.phamvanlonnguc@dutupulmo.vn',
    password: 'Doctor@123',
    fullName: 'PGS.TS.BS. Phạm Văn Lồng Ngực',
    phone: '0934567890',
    licenseNumber: 'GPHN-2006-003456',
    title: DoctorTitle.ASSOCIATE_PROFESSOR_PHD_DOCTOR,
    position: 'Trưởng khoa Ngoại lồng ngực',
    bio: 'Chuyên gia phẫu thuật ung thư phổi, phẫu thuật nội soi lồng ngực. 18 năm kinh nghiệm phẫu thuật các bệnh lý lồng ngực. Đào tạo chuyên sâu tại Nhật Bản và Hàn Quốc.',
    practiceStartYear: 2006,
    yearsOfExperience: 18,
    specialtyName: SpecialtyEnum.THORACIC_SURGERY,
    defaultConsultationFee: '700000',
    hospitalIndex: 0,
  },
  {
    email: 'bs.vuptnoisoi@dutupulmo.vn',
    password: 'Doctor@123',
    fullName: 'ThS.BS.CK2. Vũ Thị Nội Soi',
    phone: '0945678901',
    licenseNumber: 'GPHN-2010-007890',
    title: DoctorTitle.MASTER_SPECIALIST_DOCTOR_2,
    position: 'Bác sĩ Ngoại lồng ngực',
    bio: 'Chuyên gia phẫu thuật nội soi lồng ngực, điều trị tràn khí màng phổi và u phổi lành tính. 14 năm kinh nghiệm phẫu thuật lồng ngực.',
    practiceStartYear: 2010,
    yearsOfExperience: 14,
    specialtyName: SpecialtyEnum.THORACIC_SURGERY,
    defaultConsultationFee: '500000',
    hospitalIndex: 1,
  },
  // RESPIRATORY_MEDICINE - Nội khoa hô hấp
  {
    email: 'bs.nguyennoihohap@dutupulmo.vn',
    password: 'Doctor@123',
    fullName: 'TS.BS. Nguyễn Thị Nội Hô Hấp',
    phone: '0956789012',
    licenseNumber: 'GPHN-2011-001122',
    title: DoctorTitle.PHD_DOCTOR,
    position: 'Trưởng khoa Nội hô hấp',
    bio: 'Chuyên gia điều trị nội khoa các bệnh phổi. 13 năm kinh nghiệm trong chẩn đoán và điều trị viêm phổi, xơ phổi, và các bệnh phổi tự miễn.',
    practiceStartYear: 2011,
    yearsOfExperience: 13,
    specialtyName: SpecialtyEnum.RESPIRATORY_MEDICINE,
    defaultConsultationFee: '400000',
    hospitalIndex: 0,
  },
  {
    email: 'bs.tranxophoi@dutupulmo.vn',
    password: 'Doctor@123',
    fullName: 'ThS.BS.CK1. Trần Văn Xơ Phổi',
    phone: '0967890123',
    licenseNumber: 'GPHN-2015-002233',
    title: DoctorTitle.MASTER_SPECIALIST_DOCTOR_1,
    position: 'Bác sĩ Nội hô hấp',
    bio: 'Chuyên gia về bệnh phổi kẽ và xơ phổi vô căn. 9 năm kinh nghiệm điều trị các bệnh phổi hiếm gặp.',
    practiceStartYear: 2015,
    yearsOfExperience: 9,
    specialtyName: SpecialtyEnum.RESPIRATORY_MEDICINE,
    defaultConsultationFee: '350000',
    hospitalIndex: 2, // Bệnh viện Cần Thơ
  },
  // TUBERCULOSIS - Lao phổi
  {
    email: 'bs.levanlaophoi@dutupulmo.vn',
    password: 'Doctor@123',
    fullName: 'PGS.TS.BS. Lê Văn Lao Phổi',
    phone: '0978901234',
    licenseNumber: 'GPHN-2007-004455',
    title: DoctorTitle.ASSOCIATE_PROFESSOR_PHD_DOCTOR,
    position: 'Trưởng khoa Lao',
    bio: 'Chuyên gia hàng đầu về lao phổi và lao kháng thuốc. 17 năm kinh nghiệm điều trị lao phổi đa kháng (MDR-TB). Thành viên chương trình phòng chống lao quốc gia.',
    practiceStartYear: 2007,
    yearsOfExperience: 17,
    specialtyName: SpecialtyEnum.TUBERCULOSIS,
    defaultConsultationFee: '500000',
    hospitalIndex: 0,
  },
  {
    email: 'bs.hoanglaokhangthuoc@dutupulmo.vn',
    password: 'Doctor@123',
    fullName: 'TS.BS. Hoàng Thị Lao Kháng',
    phone: '0989012345',
    licenseNumber: 'GPHN-2013-005566',
    title: DoctorTitle.PHD_DOCTOR,
    position: 'Phó khoa Lao',
    bio: 'Chuyên gia lao kháng thuốc và lao ngoài phổi. 11 năm kinh nghiệm điều trị các trường hợp lao phức tạp. Nghiên cứu sinh tại Đại học Tokyo, Nhật Bản.',
    practiceStartYear: 2013,
    yearsOfExperience: 11,
    specialtyName: SpecialtyEnum.TUBERCULOSIS,
    defaultConsultationFee: '400000',
    hospitalIndex: 2,
  },
  {
    email: 'bs.phamlaotrenem@dutupulmo.vn',
    password: 'Doctor@123',
    fullName: 'BS.CK1. Phạm Văn Lao Trẻ Em',
    phone: '0990123456',
    licenseNumber: 'GPHN-2016-006677',
    title: DoctorTitle.SPECIALIST_DOCTOR_1,
    position: 'Bác sĩ điều trị',
    bio: 'Chuyên gia lao trẻ em và lao màng não. 8 năm kinh nghiệm điều trị lao ở trẻ em và thanh thiếu niên.',
    practiceStartYear: 2016,
    yearsOfExperience: 8,
    specialtyName: SpecialtyEnum.TUBERCULOSIS,
    defaultConsultationFee: '350000',
    hospitalIndex: 1,
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
    entities: [
      Doctor,
      DoctorSchedule,
      TimeSlot,
      Account,
      User,
      Patient,
      Hospital,
    ],
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    synchronize: true, // Sync schema before seeding
  });

  try {
    await dataSource.initialize();
    console.log('🔗 Kết nối database thành công');

    const doctorRepo = dataSource.getRepository(Doctor);
    const scheduleRepo = dataSource.getRepository(DoctorSchedule);
    const accountRepo = dataSource.getRepository(Account);
    const userRepo = dataSource.getRepository(User);
    const hospitalRepo = dataSource.getRepository(Hospital);

    // ========== SEED HOSPITALS ==========
    console.log('\n🏥 Seeding Hospitals (Bệnh viện Phổi)...');
    const createdHospitals: Hospital[] = [];

    for (const hospitalData of sampleHospitals) {
      const existingHospital = await hospitalRepo.findOne({
        where: { hospitalCode: hospitalData.hospitalCode },
      });

      if (existingHospital) {
        console.log(`  ⚠️ Hospital exists: ${hospitalData.name}`);
        createdHospitals.push(existingHospital);
        continue;
      }

      const hospital = hospitalRepo.create({
        name: hospitalData.name,
        hospitalCode: hospitalData.hospitalCode,
        phone: hospitalData.phone,
        email: hospitalData.email,
        address: hospitalData.address,
        latitude: hospitalData.latitude,
        longitude: hospitalData.longitude,
      });
      await hospitalRepo.save(hospital);
      createdHospitals.push(hospital);
      console.log(`  ✅ Created: ${hospitalData.name}`);
    }

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
    console.log('\n👨‍⚕️ Seeding Doctors (Bác sĩ chuyên khoa Phổi)...');
    const createdDoctors: { doctor: Doctor; hospitalIndex: number }[] = [];

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
          createdDoctors.push({
            doctor: existingDoctor,
            hospitalIndex: docData.hospitalIndex,
          });
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
          createdDoctors.push({
            doctor: existingDoctor,
            hospitalIndex: docData.hospitalIndex,
          });
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

      // Get hospital for doctor
      const hospital = createdHospitals[docData.hospitalIndex];

      // Create Doctor with hospital link
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
        primaryHospitalId: hospital?.id, // Liên kết bác sĩ với bệnh viện phổi
      });
      await doctorRepo.save(doctor);
      createdDoctors.push({ doctor, hospitalIndex: docData.hospitalIndex });

      console.log(
        `  ✅ Created: ${docData.fullName} tại ${hospital?.name || 'N/A'}`,
      );
    }

    // ========== SEED DOCTOR SCHEDULES ==========
    console.log('\n📅 Seeding Doctor Schedules (Lịch làm việc)...');

    // Get tomorrow's date as effectiveFrom
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    let schedulesCreated = 0;

    for (const { doctor } of createdDoctors) {
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
    // ========== SEED TEST CASES FOR FLEXIBLE & TIME_OFF ==========
    console.log('\n🧪 Seeding Test Cases (FLEXIBLE & TIME_OFF)...');

    // Lấy 3 bác sĩ đầu tiên để test
    const testDoctors = createdDoctors.slice(0, 3);

    if (testDoctors.length >= 3) {
      const testDate1 = new Date(tomorrow);
      testDate1.setDate(testDate1.getDate() + 7); // Ngày cụ thể +7 ngày

      const testDate2 = new Date(tomorrow);
      testDate2.setDate(testDate2.getDate() + 8); // Ngày cụ thể +8 ngày

      // ==========================================
      // TEST DOCTOR 1: REGULAR + TIME_OFF (Cases 1-4)
      // ==========================================
      const doctor1 = testDoctors[0].doctor;

      // Thứ 2: TIME_OFF nghỉ trưa 12:00-13:00
      await scheduleRepo.save(
        scheduleRepo.create({
          doctorId: doctor1.id,
          dayOfWeek: testDate1.getDay(), // Calculate from specificDate
          specificDate: testDate1,
          startTime: '12:00',
          endTime: '13:00',
          slotDuration: 30,
          slotCapacity: 1,
          appointmentType: AppointmentTypeEnum.VIDEO,
          scheduleType: ScheduleType.TIME_OFF,
          priority: 100,
          isAvailable: true,
          effectiveFrom: testDate1,
          effectiveUntil: testDate1,
          consultationFee: '0',
        }),
      );

      // Thứ 3: TIME_OFF về sớm 15:00-18:00
      await scheduleRepo.save(
        scheduleRepo.create({
          doctorId: doctor1.id,
          dayOfWeek: testDate2.getDay(), // Calculate from specificDate
          specificDate: testDate2,
          startTime: '15:00',
          endTime: '18:00',
          slotDuration: 30,
          slotCapacity: 1,
          appointmentType: AppointmentTypeEnum.VIDEO,
          scheduleType: ScheduleType.TIME_OFF,
          priority: 100,
          isAvailable: true,
          effectiveFrom: testDate2,
          effectiveUntil: testDate2,
          consultationFee: '0',
        }),
      );

      console.log(`  ✅ Doctor 1 (${doctor1.id}): REGULAR + TIME_OFF`);
      console.log(
        `     - ${testDate1.toISOString().split('T')[0]}: TIME_OFF 12:00-13:00 (Nghỉ trưa)`,
      );
      console.log(
        `     - ${testDate2.toISOString().split('T')[0]}: TIME_OFF 15:00-18:00 (Về sớm)`,
      );

      // ==========================================
      // TEST DOCTOR 2: REGULAR + FLEXIBLE + TIME_OFF (Cases 5-6)
      // ==========================================
      const doctor2 = testDoctors[1].doctor;

      // Thứ 2: FLEXIBLE 10:00-14:00 (đè lên REGULAR 08:00-17:00)
      await scheduleRepo.save(
        scheduleRepo.create({
          doctorId: doctor2.id,
          dayOfWeek: testDate1.getDay(),
          specificDate: testDate1,
          startTime: '10:00',
          endTime: '14:00',
          slotDuration: 30,
          slotCapacity: 2, // Tăng capacity để dễ phân biệt
          appointmentType: AppointmentTypeEnum.VIDEO,
          scheduleType: ScheduleType.FLEXIBLE,
          priority: 50,
          isAvailable: true,
          effectiveFrom: testDate1,
          effectiveUntil: testDate1,
          consultationFee: '400000',
        }),
      );

      // Thứ 3: FLEXIBLE 10:00-16:00
      await scheduleRepo.save(
        scheduleRepo.create({
          doctorId: doctor2.id,
          dayOfWeek: testDate2.getDay(),
          specificDate: testDate2,
          startTime: '10:00',
          endTime: '16:00',
          slotDuration: 30,
          slotCapacity: 2,
          appointmentType: AppointmentTypeEnum.VIDEO,
          scheduleType: ScheduleType.FLEXIBLE,
          priority: 50,
          isAvailable: true,
          effectiveFrom: testDate2,
          effectiveUntil: testDate2,
          consultationFee: '400000',
        }),
      );

      // Thứ 3: TIME_OFF 12:00-13:00 (nghỉ giữa giờ FLEXIBLE)
      await scheduleRepo.save(
        scheduleRepo.create({
          doctorId: doctor2.id,
          dayOfWeek: testDate2.getDay(),
          specificDate: testDate2,
          startTime: '12:00',
          endTime: '13:00',
          slotDuration: 30,
          slotCapacity: 1,
          appointmentType: AppointmentTypeEnum.VIDEO,
          scheduleType: ScheduleType.TIME_OFF,
          priority: 100,
          isAvailable: true,
          effectiveFrom: testDate2,
          effectiveUntil: testDate2,
          consultationFee: '0',
        }),
      );

      console.log(
        `  ✅ Doctor 2 (${doctor2.id}): REGULAR + FLEXIBLE + TIME_OFF`,
      );
      console.log(
        `     - ${testDate1.toISOString().split('T')[0]}: FLEXIBLE 10:00-14:00 (Đè REGULAR)`,
      );
      console.log(
        `     - ${testDate2.toISOString().split('T')[0]}: FLEXIBLE 10:00-16:00 + TIME_OFF 12:00-13:00`,
      );

      // ==========================================
      // TEST DOCTOR 3: TIME_OFF bao trùm (Cases 8-9)
      // ==========================================
      const doctor3 = testDoctors[2].doctor;

      // Thứ 2: TIME_OFF 07:00-18:00 (nghỉ cả ngày, bao trùm REGULAR 08:00-17:00)
      await scheduleRepo.save(
        scheduleRepo.create({
          doctorId: doctor3.id,
          dayOfWeek: testDate1.getDay(),
          specificDate: testDate1,
          startTime: '07:00',
          endTime: '18:00',
          slotDuration: 30,
          slotCapacity: 1,
          appointmentType: AppointmentTypeEnum.VIDEO,
          scheduleType: ScheduleType.TIME_OFF,
          priority: 100,
          isAvailable: true,
          effectiveFrom: testDate1,
          effectiveUntil: testDate1,
          consultationFee: '0',
        }),
      );

      // Thứ 3: FLEXIBLE 13:00-15:00
      await scheduleRepo.save(
        scheduleRepo.create({
          doctorId: doctor3.id,
          dayOfWeek: testDate2.getDay(),
          specificDate: testDate2,
          startTime: '13:00',
          endTime: '15:00',
          slotDuration: 30,
          slotCapacity: 2,
          appointmentType: AppointmentTypeEnum.VIDEO,
          scheduleType: ScheduleType.FLEXIBLE,
          priority: 50,
          isAvailable: true,
          effectiveFrom: testDate2,
          effectiveUntil: testDate2,
          consultationFee: '350000',
        }),
      );

      // Thứ 3: TIME_OFF 12:00-16:00 (nuốt trọn FLEXIBLE 13:00-15:00)
      await scheduleRepo.save(
        scheduleRepo.create({
          doctorId: doctor3.id,
          dayOfWeek: testDate2.getDay(),
          specificDate: testDate2,
          startTime: '12:00',
          endTime: '16:00',
          slotDuration: 30,
          slotCapacity: 1,
          appointmentType: AppointmentTypeEnum.VIDEO,
          scheduleType: ScheduleType.TIME_OFF,
          priority: 100,
          isAvailable: true,
          effectiveFrom: testDate2,
          effectiveUntil: testDate2,
          consultationFee: '0',
        }),
      );

      console.log(`  ✅ Doctor 3 (${doctor3.id}): TIME_OFF bao trùm`);
      console.log(
        `     - ${testDate1.toISOString().split('T')[0]}: TIME_OFF 07:00-18:00 (Nghỉ cả ngày)`,
      );
      console.log(
        `     - ${testDate2.toISOString().split('T')[0]}: FLEXIBLE 13:00-15:00 bị TIME_OFF 12:00-16:00 nuốt trọn`,
      );

      schedulesCreated += 8; // Thêm 8 schedules test
    }

    console.log('🧪 Test cases seeding completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // ========== SUMMARY ==========
    console.log('\n🎉 Seed hoàn thành thành công!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DUTU PULMO - HỆ THỐNG PHÒNG KHÁM PHỔI');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🏥 Bệnh viện phổi: ${sampleHospitals.length}`);
    console.log(`👤 Quản trị viên: 1`);
    console.log(`👨‍⚕️ Bác sĩ chuyên khoa: ${sampleDoctors.length}`);
    console.log(`   - Hô hấp (Pulmonology): 3`);
    console.log(`   - Phẫu thuật lồng ngực (Thoracic Surgery): 2`);
    console.log(`   - Nội khoa hô hấp (Respiratory Medicine): 2`);
    console.log(`   - Lao phổi (Tuberculosis): 3`);
    console.log(`📅 Lịch làm việc đã tạo: ${schedulesCreated}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🔐 THÔNG TIN ĐĂNG NHẬP:');
    console.log(`   📧 Admin: ${adminData.email} / Admin@123456`);
    console.log('   📧 Doctor: bs.nguyenvanphoi@dutupulmo.vn / Doctor@123');
    console.log('');

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Seed thất bại:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

seed();
