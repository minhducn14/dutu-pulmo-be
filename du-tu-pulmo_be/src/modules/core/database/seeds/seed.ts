import { DataSource, MoreThan, Between, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { fakerVI as faker } from '@faker-js/faker';
import * as path from 'path';

// Core Imports (we can keep these for explicit usage in code)
import { Doctor } from '../../../doctor/entities/doctor.entity';
import { DoctorSchedule } from '../../../doctor/entities/doctor-schedule.entity';
import { TimeSlot } from '../../../doctor/entities/time-slot.entity';
import { Account } from '../../../account/entities/account.entity';
import { User } from '../../../user/entities/user.entity';
import { Patient } from '../../../patient/entities/patient.entity';
import { Hospital } from '../../../hospital/entities/hospital.entity';
import { Appointment } from '../../../appointment/entities/appointment.entity';

// Enums
import { DoctorTitle } from '../../../common/enums/doctor-title.enum';
import { SpecialtyEnum } from '../../../common/enums/specialty.enum';
import { RoleEnum } from '../../../common/enums/role.enum';
import { UserStatusEnum } from '../../../common/enums/user-status.enum';
import { ScheduleType, SCHEDULE_TYPE_PRIORITY } from '../../../common/enums/schedule-type.enum';
import { AppointmentTypeEnum } from '../../../common/enums/appointment-type.enum';
import { AppointmentStatusEnum } from '../../../common/enums/appointment-status.enum';
import { GenderEnum } from '../../../common/enums/gender.enum';


async function seed() {
  require('dotenv').config();
  const entitiesPath = path.join(__dirname, '../../../../**/*.entity{.ts,.js}');

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DB_URL,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [entitiesPath],
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    synchronize: true, // Sync schema before seeding
    dropSchema: true, // Drop schema to ensure Enums are updated
  });

  try {
    await dataSource.initialize();
    console.log('🔗 Kết nối database thành công');

    const doctorRepo = dataSource.getRepository(Doctor);
    const scheduleRepo = dataSource.getRepository(DoctorSchedule);
    const timeSlotRepo = dataSource.getRepository(TimeSlot);
    const accountRepo = dataSource.getRepository(Account);
    const userRepo = dataSource.getRepository(User);
    const hospitalRepo = dataSource.getRepository(Hospital);
    const patientRepo = dataSource.getRepository(Patient);
    const appointmentRepo = dataSource.getRepository(Appointment);

    // ========== SEED HOSPITALS ==========
    console.log('\n🏥 Seeding Hospitals...');
    const hospitals = [
      {
        name: 'Bệnh viện Phổi Trung ương',
        code: 'BVPTW',
        address: '463 Hoàng Hoa Thám, Tây Hồ, Hà Nội',
        lat: 21.0556, long: 105.8145
      },
      {
        name: 'Bệnh viện Phổi TP. Hồ Chí Minh',
        code: 'BVPHCM',
        address: '587 Huỳnh Văn Bánh, Phú Nhuận, TP.HCM',
        lat: 10.7985, long: 106.6736
      },
      {
        name: 'Bệnh viện Lao và Bệnh phổi Cần Thơ',
        code: 'BVLBPCT',
        address: '89 Trần Hưng Đạo, Ninh Kiều, Cần Thơ',
        lat: 10.0346, long: 105.7676
      },
    ];

    const createdHospitals: Hospital[] = [];
    for (const h of hospitals) {
      let hospital = await hospitalRepo.findOne({ where: { hospitalCode: h.code } });
      if (!hospital) {
        hospital = hospitalRepo.create({
          name: h.name,
          hospitalCode: h.code,
          phone: faker.phone.number(),
          email: `contact@${h.code.toLowerCase()}.vn`,
          address: h.address,
          latitude: h.lat,
          longitude: h.long,
        });
        await hospitalRepo.save(hospital);
      }
      createdHospitals.push(hospital);
    }
    console.log(`   ✅ ${createdHospitals.length} Hospitals ready.`);

    // ========== SEED ADMIN ==========
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@dutupulmo.vn';
    let adminAccount = await accountRepo.findOne({ where: { email: adminEmail } });
    if (!adminAccount) {
      const adminUser = await userRepo.save(userRepo.create({ fullName: 'Administrator', status: UserStatusEnum.ACTIVE }));
      await accountRepo.save(accountRepo.create({
        email: adminEmail,
        password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123456', 10),
        roles: [RoleEnum.ADMIN],
        isVerified: true,
        userId: adminUser.id,
      }));
      console.log('   ✅ Admin account created.');
    } else {
      console.log('   ℹ️ Admin account exists.');
    }

    // ========== SEED DOCTORS (5 Specializations) ==========
    console.log('\n👨‍⚕️ Seeding Doctors...');
    const doctorSpecs = [
      { name: 'Dr. Respiratory', email: 'respiratory@dutupulmo.vn', spec: SpecialtyEnum.RESPIRATORY_MEDICINE },
      { name: 'Dr. Pulmo', email: 'pulmo@dutupulmo.vn', spec: SpecialtyEnum.PULMONOLOGY },
      { name: 'Dr. Thoracic', email: 'thoracic@dutupulmo.vn', spec: SpecialtyEnum.THORACIC_SURGERY },
      { name: 'Dr. Tuberculosis', email: 'tuberculosis@dutupulmo.vn', spec: SpecialtyEnum.TUBERCULOSIS },
      { name: 'Dr. Surgery', email: 'surgery@dutupulmo.vn', spec: SpecialtyEnum.THORACIC_SURGERY },
    ];

    const createdDoctors: Doctor[] = [];

    for (const [index, ds] of doctorSpecs.entries()) {
      let account = await accountRepo.findOne({ where: { email: ds.email } });
      let doctor: Doctor;

      if (!account) {
        const user = await userRepo.save(userRepo.create({
          fullName: ds.name,
          phone: faker.phone.number(),
          gender: index % 2 === 0 ? GenderEnum.MALE : GenderEnum.FEMALE,
          status: UserStatusEnum.ACTIVE,
        }));
        account = await accountRepo.save(accountRepo.create({
          email: ds.email,
          password: await bcrypt.hash('Doctor@123', 10),
          roles: [RoleEnum.DOCTOR],
          isVerified: true,
          userId: user.id,
        }));
        
        doctor = await doctorRepo.save(doctorRepo.create({
          userId: user.id,
          licenseNumber: `LIC-${faker.string.alphanumeric(6).toUpperCase()}`,
          title: DoctorTitle.SPECIALIST_DOCTOR_1,
          specialty: ds.spec,
          yearsOfExperience: faker.number.int({ min: 5, max: 20 }),
          bio: faker.lorem.paragraph(),
          defaultConsultationFee: faker.commerce.price({ min: 200000, max: 1000000, dec: 0 }),
          primaryHospitalId: createdHospitals[index % createdHospitals.length].id,
        }));
      } else {
        doctor = (await doctorRepo.findOne({ where: { userId: account.userId } }))!;
      }
      createdDoctors.push(doctor);
    }
    console.log(`   ✅ ${createdDoctors.length} Doctors ready.`);

    // ========== SEED DOCTOR SCHEDULES (Recurring) ==========
    console.log('\n📅 Seeding Schedules...');
    for (const doctor of createdDoctors) {
      const existing = await scheduleRepo.count({ where: { doctorId: doctor.id } });
      if (existing > 0) continue;

      for (let day = 1; day <= 5; day++) {
        await scheduleRepo.save(scheduleRepo.create({
            doctorId: doctor.id,
            dayOfWeek: day,
            startTime: '08:00', endTime: '12:00',
            slotDuration: 30, slotCapacity: 1,
            scheduleType: ScheduleType.REGULAR, priority: 0, 
            isAvailable: true, appointmentType: AppointmentTypeEnum.VIDEO,
            maxAdvanceBookingDays: 60,
        }));
        await scheduleRepo.save(scheduleRepo.create({
            doctorId: doctor.id,
            dayOfWeek: day,
            startTime: '13:00', endTime: '17:00',
            slotDuration: 30, slotCapacity: 1,
            scheduleType: ScheduleType.REGULAR, priority: 0,
            isAvailable: true, appointmentType: AppointmentTypeEnum.VIDEO,
            maxAdvanceBookingDays: 60,
        }));
      }
      await scheduleRepo.save(scheduleRepo.create({
          doctorId: doctor.id,
          dayOfWeek: 6,
          startTime: '09:00', endTime: '13:00',
          slotDuration: 30, slotCapacity: 1,
          scheduleType: ScheduleType.REGULAR, priority: 0,
          isAvailable: true, appointmentType: AppointmentTypeEnum.IN_CLINIC,
          maxAdvanceBookingDays: 60,
      }));

      const numOffs = faker.number.int({ min: 3, max: 5 });
      for (let i = 0; i < numOffs; i++) {
        const date = faker.date.soon({ days: 60 });
        await scheduleRepo.save(scheduleRepo.create({
            doctorId: doctor.id,
            scheduleType: ScheduleType.TIME_OFF,
            priority: 100, // High priority
            startTime: '00:00', endTime: '23:59',
            specificDate: date,
            dayOfWeek: date.getDay(),
            isAvailable: false,
            effectiveFrom: date, effectiveUntil: date,
        }));
      }
    }
    console.log('   ✅ Schedules & TimeOffs set.');

    // ========== SEED PATIENTS (30) ==========
    console.log('\n👤 Seeding Patients...');
    const createdPatients: Patient[] = [];
    const targetPatients = 30;
    const currentCount = await patientRepo.count();
    
    // Always ensure at least 30 active test patients
    const needed = Math.max(0, targetPatients - currentCount);
    
    for (let i = 0; i < needed; i++) {
        const gender = faker.person.sex() as 'male' | 'female';
        const genderEnum = gender === 'male' ? GenderEnum.MALE : GenderEnum.FEMALE;
        const firstName = faker.person.firstName(gender);
        const lastName = faker.person.lastName(gender);
        const fullName = `${lastName} ${firstName}`;
        const email = faker.internet.email({ firstName, lastName }).toLowerCase();

        const user = await userRepo.save(userRepo.create({
            fullName,
            phone: faker.phone.number(),
            gender: genderEnum,
            status: UserStatusEnum.ACTIVE,
            dateOfBirth: faker.date.birthdate({ min: 18, max: 80, mode: 'age' }),
            address: faker.location.streetAddress({ useFullAddress: true }),
        }));

        await accountRepo.save(accountRepo.create({
            email,
            password: await bcrypt.hash('Patient@123', 10),
            roles: [RoleEnum.PATIENT],
            isVerified: true,
            userId: user.id,
        }));

        const patient = await patientRepo.save(patientRepo.create({
            userId: user.id,
            bloodType: faker.helpers.arrayElement(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']),
            insuranceProvider: faker.helpers.arrayElement(['Bao Viet', 'Manulife', 'Prudential']),
            insuranceNumber: faker.string.alphanumeric(10).toUpperCase(),
        }));
        createdPatients.push(patient);
    }
    const allPatients = await patientRepo.find();
    console.log(`   ✅ ${allPatients.length} Patients ready.`);

    // ========== SEED APPOINTMENTS (~100) ==========
    console.log('\n📅 Seeding Appointments...');
    const totalApps = 100;
    let appsCreated = 0;
    
    for (let i = 0; i < totalApps; i++) {
        const rand = Math.random();
        let date: Date;
        let status: AppointmentStatusEnum;

        if (rand < 0.3) {
            // Past
            date = faker.date.recent({ days: 60 });
            status = faker.helpers.arrayElement([AppointmentStatusEnum.COMPLETED, AppointmentStatusEnum.COMPLETED, AppointmentStatusEnum.CANCELLED]);
        } else if (rand < 0.4) {
            // Present
            date = new Date(); 
            date.setHours(faker.number.int({ min: 8, max: 16 }), faker.helpers.arrayElement([0, 30]), 0, 0); 
            status = faker.helpers.arrayElement([AppointmentStatusEnum.CHECKED_IN, AppointmentStatusEnum.IN_PROGRESS, AppointmentStatusEnum.PENDING]);
        } else {
            // Future
            date = faker.date.soon({ days: 60 });
            status = AppointmentStatusEnum.PENDING;
        }

        if (rand >= 0.4 || rand < 0.3) {
             let hour = date.getHours();
             if (hour < 8) hour = 8;
             if (hour === 12) hour = 13;
             if (hour > 17) hour = 16;
             date.setHours(hour, faker.helpers.arrayElement([0, 30]), 0, 0);
        }

        const doctor = faker.helpers.arrayElement(createdDoctors);
        const patient = faker.helpers.arrayElement(allPatients);
        const type = faker.helpers.arrayElement([AppointmentTypeEnum.IN_CLINIC, AppointmentTypeEnum.VIDEO]);

        const appointment = await appointmentRepo.save(appointmentRepo.create({
            doctorId: doctor.id,
            patientId: patient.id,
            scheduledAt: date, 
            durationMinutes: 30, 
            status: status,
            appointmentType: type,
            appointmentNumber: `APT-${faker.string.alphanumeric(8).toUpperCase()}`,
            chiefComplaint: faker.lorem.sentence(), 
            feeAmount: doctor.defaultConsultationFee || '0',
        }));
        appsCreated++;
    }
    console.log(`   ✅ ${appsCreated} Appointments created.`);

    // ========== GENERATE TIME SLOTS (60 Days) ==========
    console.log('\n⏳ Generating TimeSlots (60 Days)...');
    const startDate = new Date();
    startDate.setHours(0,0,0,0);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 60);

    let slotsGenerated = 0;

    for (const doctor of createdDoctors) {
       const iterDate = new Date(startDate);
       while (iterDate <= futureDate) {
           const dayOfWeek = iterDate.getDay();
           
           const dayStart = new Date(iterDate); dayStart.setHours(0,0,0,0);
           const dayEnd = new Date(iterDate); dayEnd.setHours(23,59,59,999);

           const specialSchedules = await scheduleRepo.find({
               where: {
                   doctorId: doctor.id,
                   specificDate: Between(dayStart, dayEnd),
                   priority: MoreThan(0)
               },
               order: { priority: 'DESC' }
           });

           const regularSchedules = await scheduleRepo.find({
               where: {
                   doctorId: doctor.id,
                   scheduleType: ScheduleType.REGULAR,
                   dayOfWeek: dayOfWeek,
                   isAvailable: true
               }
           });

           let activeSchedules: DoctorSchedule[] = [];
           
           if (specialSchedules.length > 0) {
               activeSchedules = specialSchedules;
           } else {
               activeSchedules = regularSchedules;
           }

           for (const sched of activeSchedules) {
               if (!sched.isAvailable) continue;

               const [sH, sM] = sched.startTime.split(':').map(Number);
               const [eH, eM] = sched.endTime.split(':').map(Number);
               const slotDurMs = sched.slotDuration * 60000;

               const rangeStart = new Date(iterDate); rangeStart.setHours(sH, sM, 0, 0);
               const rangeEnd = new Date(iterDate); rangeEnd.setHours(eH, eM, 0, 0);

               let curr = rangeStart.getTime();
               while (curr + slotDurMs <= rangeEnd.getTime()) {
                   const slotStart = new Date(curr);
                   const slotEnd = new Date(curr + slotDurMs);

                   const existingApp = await appointmentRepo.findOne({
                       where: {
                           doctorId: doctor.id,
                           scheduledAt: slotStart // Fix: dateTime -> scheduledAt
                       }
                   });

                   await timeSlotRepo.save(timeSlotRepo.create({
                       doctorId: doctor.id,
                       scheduleId: sched.id,
                       startTime: slotStart,
                       endTime: slotEnd,
                       isAvailable: !existingApp,
                       capacity: sched.slotCapacity,
                       bookedCount: existingApp ? 1 : 0
                   }));
                   slotsGenerated++;
                   curr += slotDurMs;
               }
           }
           iterDate.setDate(iterDate.getDate() + 1);
       }
    }
    console.log(`   ✅ ${slotsGenerated} TimeSlots generated.`);

    console.log('\n🎉 Seed Completed Successfully!');
    console.log('Admin: ' + adminEmail);
    console.log('Doctors: 5 (e.g. general@dutupulmo.vn / Doctor@123)');
    console.log('Patients: 30 (e.g. random emails / Patient@123)');
    
    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Seed Failed:', error);
    if(dataSource.isInitialized) await dataSource.destroy();
    process.exit(1);
  }
}

seed();
