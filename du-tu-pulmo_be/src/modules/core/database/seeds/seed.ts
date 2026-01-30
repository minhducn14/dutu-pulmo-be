import { DataSource, MoreThan, Between } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { fakerVI as faker } from '@faker-js/faker';
import * as path from 'path';
import * as dotenv from 'dotenv';

import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { Account } from '@/modules/account/entities/account.entity';
import { User } from '@/modules/user/entities/user.entity';
import { Patient } from '@/modules/patient/entities/patient.entity';
import { Hospital } from '@/modules/hospital/entities/hospital.entity';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';
import { Prescription } from '@/modules/medical/entities/prescription.entity';
import { PrescriptionItem } from '@/modules/medical/entities/prescription-item.entity';
import { Medicine } from '@/modules/medical/entities/medicine.entity';

import { DoctorTitle } from '@/modules/common/enums/doctor-title.enum';
import { SpecialtyEnum } from '@/modules/common/enums/specialty.enum';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { UserStatusEnum } from '@/modules/common/enums/user-status.enum';
import { ScheduleType } from '@/modules/common/enums/schedule-type.enum';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { GenderEnum } from '@/modules/common/enums/gender.enum';
import { PrescriptionStatusEnum } from '@/modules/common/enums/prescription-status.enum';
import {
  GoodsType,
  MedicineGroup,
  RouteOfAdministration,
  UnitOfMeasure,
} from '@/modules/medical/enums/medicine.enums';

async function seed() {
  dotenv.config();

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
    const medicalRecordRepo = dataSource.getRepository(MedicalRecord);
    const prescriptionRepo = dataSource.getRepository(Prescription);
    const prescriptionItemRepo = dataSource.getRepository(PrescriptionItem);
    const medicineRepo = dataSource.getRepository(Medicine);

    // ========== SEED HOSPITALS ==========
    console.log('\n🏥 Seeding Hospitals...');
    const hospitals = [
      {
        name: 'Bệnh viện Phổi Trung ương',
        code: 'BVPTW',
        address: '463 Hoàng Hoa Thám, Tây Hồ, Hà Nội',
        lat: 21.0556,
        long: 105.8145,
      },
      {
        name: 'Bệnh viện Phổi TP. Hồ Chí Minh',
        code: 'BVPHCM',
        address: '587 Huỳnh Văn Bánh, Phú Nhuận, TP.HCM',
        lat: 10.7985,
        long: 106.6736,
      },
      {
        name: 'Bệnh viện Lao và Bệnh phổi Cần Thơ',
        code: 'BVLBPCT',
        address: '89 Trần Hưng Đạo, Ninh Kiều, Cần Thơ',
        lat: 10.0346,
        long: 105.7676,
      },
    ];

    const createdHospitals: Hospital[] = [];
    for (const h of hospitals) {
      let hospital = await hospitalRepo.findOne({
        where: { hospitalCode: h.code },
      });
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
    const adminAccount = await accountRepo.findOne({
      where: { email: adminEmail },
    });
    if (!adminAccount) {
      const adminUser = await userRepo.save(
        userRepo.create({
          fullName: 'Administrator',
          status: UserStatusEnum.ACTIVE,
        }),
      );
      await accountRepo.save(
        accountRepo.create({
          email: adminEmail,
          password: await bcrypt.hash(
            process.env.ADMIN_PASSWORD || 'Admin@123456',
            12,
          ),
          roles: [RoleEnum.ADMIN],
          isVerified: true,
          userId: adminUser.id,
        }),
      );
      console.log('   ✅ Admin account created.');
    } else {
      console.log('   ℹ️ Admin account exists.');
    }

    // ========== SEED MEDICINES ==========
    console.log('\n💊 Seeding Medicines...');
    const medicineData = [
      {
        name: 'Augmentin 1g',
        activeIngredient: 'Amoxicillin + Clavulanic acid',
        content: '875mg + 125mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.ANTIBIOTICS,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 2 vỉ x 7 viên',
      },
      {
        name: 'Zinnat 500mg',
        activeIngredient: 'Cefuroxime',
        content: '500mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.ANTIBIOTICS,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 1 vỉ x 10 viên',
      },
      {
        name: 'Ventolin Nebules',
        activeIngredient: 'Salbutamol',
        content: '2.5mg/2.5ml',
        unit: UnitOfMeasure.AMPOULE,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.NEBULIZATION,
        packing: 'Hộp 30 ống',
      },
      {
        name: 'Seretide Evohaler',
        activeIngredient: 'Salmeterol + Fluticasone',
        content: '25/125mcg',
        unit: UnitOfMeasure.BOTTLE,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.INHALATION,
        packing: 'Hộp 1 bình 120 liều',
      },
      {
        name: 'Symbicort Turbuhaler',
        activeIngredient: 'Budesonide + Formoterol',
        content: '160/4.5mcg',
        unit: UnitOfMeasure.BOTTLE,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.INHALATION,
        packing: 'Hộp 1 bình 60 liều',
      },
      {
        name: 'Medrol 16mg',
        activeIngredient: 'Methylprednisolone',
        content: '16mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.HORMONES,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 3 vỉ x 10 viên',
      },
      {
        name: 'Solu-Medrol 40mg',
        activeIngredient: 'Methylprednisolone',
        content: '40mg',
        unit: UnitOfMeasure.VIAL,
        group: MedicineGroup.HORMONES,
        route: RouteOfAdministration.INJECTION,
        packing: 'Hộp 1 lọ',
      },
      {
        name: 'Acemuc 200mg',
        activeIngredient: 'Acetylcysteine',
        content: '200mg',
        unit: UnitOfMeasure.PACKET,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 30 gói',
      },
      {
        name: 'Bisolvon 8mg',
        activeIngredient: 'Bromhexine',
        content: '8mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 30 viên',
      },
      {
        name: 'Panadol Extra',
        activeIngredient: 'Paracetamol + Caffeine',
        content: '500mg + 65mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.NSAIDS,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 15 vỉ x 12 viên',
      },
      {
        name: 'Efferalgan 500mg',
        activeIngredient: 'Paracetamol',
        content: '500mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.NSAIDS,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 16 viên sủi',
      },
      {
        name: 'Aerius 5mg',
        activeIngredient: 'Desloratadine',
        content: '5mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 1 vỉ x 10 viên',
      },
      {
        name: 'Singulair 10mg',
        activeIngredient: 'Montelukast',
        content: '10mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 4 vỉ x 7 viên',
      },
      {
        name: 'Spiriva Respimat',
        activeIngredient: 'Tiotropium',
        content: '2.5mcg',
        unit: UnitOfMeasure.BOTTLE,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.INHALATION,
        packing: 'Hộp 1 bình 60 nhát',
      },
      {
        name: 'Klacid 500mg',
        activeIngredient: 'Clarithromycin',
        content: '500mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.ANTIBIOTICS,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 1 vỉ x 14 viên',
      },
      {
        name: 'Nexium 40mg',
        activeIngredient: 'Esomeprazole',
        content: '40mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.GASTRIC_ULCER,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 2 vỉ x 7 viên',
      },
      {
        name: 'Rifampicin 300mg',
        activeIngredient: 'Rifampicin',
        content: '300mg',
        unit: UnitOfMeasure.CAPSULE,
        group: MedicineGroup.TUBERCULOSIS,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 10 vỉ x 10 viên',
      },
      {
        name: 'Ethambutol 400mg',
        activeIngredient: 'Ethambutol',
        content: '400mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.TUBERCULOSIS,
        route: RouteOfAdministration.ORAL,
        packing: 'Lọ 100 viên',
      },
      {
        name: 'Pyrazinamide 500mg',
        activeIngredient: 'Pyrazinamide',
        content: '500mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.TUBERCULOSIS,
        route: RouteOfAdministration.ORAL,
        packing: 'Vỉ 10 viên',
      },
      {
        name: 'Isoniazid 300mg',
        activeIngredient: 'Isoniazid',
        content: '300mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.TUBERCULOSIS,
        route: RouteOfAdministration.ORAL,
        packing: 'Lọ 100 viên',
      },
    ];

    const createdMedicines: Medicine[] = [];
    for (const m of medicineData) {
      const existing = await medicineRepo.findOne({ where: { name: m.name } });
      if (!existing) {
        const med = await medicineRepo.save(
          medicineRepo.create({
            ...m,
            goodsType: GoodsType.MEDICINE,
            status: true,
            manufacturer: faker.company.name(),
            countryOfOrigin: faker.location.country(),
            guide: faker.lorem.sentence(),
            registrationNumber: `VN-${faker.number.int({ min: 10000, max: 99999 })}-24`,
          }),
        );
        createdMedicines.push(med);
      } else {
        createdMedicines.push(existing);
      }
    }
    console.log(`   ✅ ${createdMedicines.length} Medicines ready.`);

    // ========== SEED DOCTORS (5 Specializations) ==========
    console.log('\n👨‍⚕️ Seeding Doctors...');
    const doctorSpecs = [
      {
        name: 'Dr. Respiratory',
        email: 'respiratory@dutupulmo.vn',
        spec: SpecialtyEnum.RESPIRATORY_MEDICINE,
      },
      {
        name: 'Dr. Pulmo',
        email: 'pulmo@dutupulmo.vn',
        spec: SpecialtyEnum.PULMONOLOGY,
      },
      {
        name: 'Dr. Thoracic',
        email: 'thoracic@dutupulmo.vn',
        spec: SpecialtyEnum.THORACIC_SURGERY,
      },
      {
        name: 'Dr. Tuberculosis',
        email: 'tuberculosis@dutupulmo.vn',
        spec: SpecialtyEnum.TUBERCULOSIS,
      },
      {
        name: 'Dr. Surgery',
        email: 'surgery@dutupulmo.vn',
        spec: SpecialtyEnum.THORACIC_SURGERY,
      },
    ];

    const createdDoctors: Doctor[] = [];

    for (const [index, ds] of doctorSpecs.entries()) {
      let account = await accountRepo.findOne({ where: { email: ds.email } });
      let doctor: Doctor;

      if (!account) {
        const user = await userRepo.save(
          userRepo.create({
            fullName: ds.name,
            phone: faker.phone.number(),
            gender: index % 2 === 0 ? GenderEnum.MALE : GenderEnum.FEMALE,
            status: UserStatusEnum.ACTIVE,
          }),
        );
        account = await accountRepo.save(
          accountRepo.create({
            email: ds.email,
            password: await bcrypt.hash('Doctor@123', 12),
            roles: [RoleEnum.DOCTOR],
            isVerified: true,
            userId: user.id,
          }),
        );

        doctor = await doctorRepo.save(
          doctorRepo.create({
            userId: user.id,
            licenseNumber: `LIC-${faker.string.alphanumeric(6).toUpperCase()}`,
            title: DoctorTitle.SPECIALIST_DOCTOR_1,
            specialty: ds.spec,
            yearsOfExperience: faker.number.int({ min: 5, max: 20 }),
            bio: faker.lorem.paragraph(),
            defaultConsultationFee: faker.commerce.price({
              min: 200000,
              max: 1000000,
              dec: 0,
            }),
            primaryHospitalId:
              createdHospitals[index % createdHospitals.length].id,
          }),
        );
      } else {
        doctor = (await doctorRepo.findOne({
          where: { userId: account.userId },
        }))!;
      }
      createdDoctors.push(doctor);
    }
    console.log(`   ✅ ${createdDoctors.length} Doctors ready.`);

    // ========== SEED DOCTOR SCHEDULES (Recurring) ==========
    console.log('\n📅 Seeding Schedules...');
    for (const doctor of createdDoctors) {
      const existing = await scheduleRepo.count({
        where: { doctorId: doctor.id },
      });
      if (existing > 0) continue;

      for (let day = 1; day <= 5; day++) {
        await scheduleRepo.save(
          scheduleRepo.create({
            doctorId: doctor.id,
            dayOfWeek: day,
            startTime: '08:00',
            endTime: '12:00',
            slotDuration: 30,
            slotCapacity: 1,
            scheduleType: ScheduleType.REGULAR,
            priority: 0,
            isAvailable: true,
            appointmentType: AppointmentTypeEnum.IN_CLINIC,
            maxAdvanceBookingDays: 60,
          }),
        );
        await scheduleRepo.save(
          scheduleRepo.create({
            doctorId: doctor.id,
            dayOfWeek: day,
            startTime: '13:00',
            endTime: '17:00',
            slotDuration: 30,
            slotCapacity: 1,
            scheduleType: ScheduleType.REGULAR,
            priority: 0,
            isAvailable: true,
            appointmentType: AppointmentTypeEnum.IN_CLINIC,
            maxAdvanceBookingDays: 60,
          }),
        );
      }
      await scheduleRepo.save(
        scheduleRepo.create({
          doctorId: doctor.id,
          dayOfWeek: 6,
          startTime: '09:00',
          endTime: '13:00',
          slotDuration: 30,
          slotCapacity: 1,
          scheduleType: ScheduleType.REGULAR,
          priority: 0,
          isAvailable: true,
          appointmentType: AppointmentTypeEnum.IN_CLINIC,
          maxAdvanceBookingDays: 60,
        }),
      );

      const numOffs = faker.number.int({ min: 3, max: 5 });
      for (let i = 0; i < numOffs; i++) {
        const date = faker.date.soon({ days: 60 });
        await scheduleRepo.save(
          scheduleRepo.create({
            doctorId: doctor.id,
            scheduleType: ScheduleType.TIME_OFF,
            priority: 100, // High priority
            startTime: '00:00',
            endTime: '23:59',
            specificDate: date,
            dayOfWeek: date.getDay(),
            isAvailable: false,
            effectiveFrom: date,
            effectiveUntil: date,
          }),
        );
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
      const genderEnum =
        gender === 'male' ? GenderEnum.MALE : GenderEnum.FEMALE;
      const firstName = faker.person.firstName(gender);
      const lastName = faker.person.lastName(gender);
      const fullName = `${lastName} ${firstName}`;
      const email = faker.internet.email({ firstName, lastName }).toLowerCase();

      const user = await userRepo.save(
        userRepo.create({
          fullName,
          phone: faker.phone.number(),
          gender: genderEnum,
          status: UserStatusEnum.ACTIVE,
          dateOfBirth: faker.date.birthdate({ min: 18, max: 80, mode: 'age' }),
          address: faker.location.streetAddress({ useFullAddress: true }),
        }),
      );

      await accountRepo.save(
        accountRepo.create({
          email,
          password: await bcrypt.hash('Patient@123', 12),
          roles: [RoleEnum.PATIENT],
          isVerified: true,
          userId: user.id,
        }),
      );

      const patient = await patientRepo.save(
        patientRepo.create({
          userId: user.id,
          bloodType: faker.helpers.arrayElement([
            'A+',
            'A-',
            'B+',
            'B-',
            'O+',
            'O-',
            'AB+',
            'AB-',
          ]),
          insuranceProvider: faker.helpers.arrayElement([
            'Bao Viet',
            'Manulife',
            'Prudential',
          ]),
          insuranceNumber: faker.string.alphanumeric(10).toUpperCase(),
        }),
      );
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

      if (rand < 0.2) {
        // Past
        date = faker.date.recent({ days: 60 });
        status = faker.helpers.arrayElement([
          AppointmentStatusEnum.COMPLETED,
          AppointmentStatusEnum.COMPLETED,
          AppointmentStatusEnum.CANCELLED,
        ]);
      } else if (rand < 0.7) {
        // Present (TODAY) - Focus on Flow 1 states
        date = new Date();
        date.setHours(
          faker.number.int({ min: 8, max: 16 }),
          faker.helpers.arrayElement([0, 30]),
          0,
          0,
        );
        // 50% CONFIRMED (Ready to Check-in), 50% CHECKED_IN (Ready to Start)
        status = faker.helpers.weightedArrayElement([
          { weight: 5, value: AppointmentStatusEnum.CONFIRMED },
          { weight: 5, value: AppointmentStatusEnum.CHECKED_IN },
        ]);
      } else {
        // Future
        date = faker.date.soon({ days: 60 });
        status = AppointmentStatusEnum.CONFIRMED;
      }

      if (rand >= 0.7 || rand < 0.2) {
        let hour = date.getHours();
        if (hour < 8) hour = 8;
        if (hour === 12) hour = 13;
        if (hour > 17) hour = 16;
        date.setHours(hour, faker.helpers.arrayElement([0, 30]), 0, 0);
      }

      const doctor = faker.helpers.arrayElement(createdDoctors);
      const patient = faker.helpers.arrayElement(allPatients);
      // FORCE IN_CLINIC for Flow 1 testing
      const type = AppointmentTypeEnum.IN_CLINIC;

      const appointment = await appointmentRepo.save(
        appointmentRepo.create({
          doctorId: doctor.id,
          patientId: patient.id,
          scheduledAt: date,
          durationMinutes: 30,
          status: status,
          appointmentType: type,
          appointmentNumber: `APT-${faker.string.alphanumeric(8).toUpperCase()}`,
          chiefComplaint: faker.lorem.sentence(),
          feeAmount: doctor.defaultConsultationFee || '0',
        }),
      );
      appsCreated++;

      // ========== MEDICAL RECORDS (For COMPLETED) ==========
      if (status === AppointmentStatusEnum.COMPLETED) {
        const hasXray = faker.datatype.boolean({ probability: 0.5 });

        const record = await medicalRecordRepo.save(
          medicalRecordRepo.create({
            appointmentId: appointment.id,
            patientId: patient.id,
            doctorId: doctor.id,
            recordNumber: `REC-${appointment.appointmentNumber || faker.string.alphanumeric(6)}-${faker.string.alphanumeric(4)}`,
            diagnosisNotes: hasXray
              ? `Acute Bronchitis. X-Ray Findings: ${faker.helpers.arrayElement(['Infiltrates in lower lobe', 'Clear lungs', 'Minor opacity'])}`
              : 'Common Cold',
            chiefComplaint: faker.lorem.sentence(),
            medicalHistory: JSON.stringify(
              faker.helpers.arrayElements(['Diabetes', 'Hypertension'], 1),
            ),
            allergies: faker.helpers.arrayElements(['Peanuts', 'Dust'], 1),
          }),
        );

        // Create Prescription
        if (faker.datatype.boolean()) {
          const prescription = await prescriptionRepo.save(
            prescriptionRepo.create({
              appointmentId: appointment.id,
              medicalRecordId: record.id,
              patientId: patient.id,
              doctorId: doctor.id,
              prescriptionNumber: `RX-${faker.string.alphanumeric(8).toUpperCase()}`,
              status: PrescriptionStatusEnum.ACTIVE,
              validUntil: faker.date.soon({ days: 30 }),
            }),
          );

          // Create Items (1-3 items)
          const numItems = faker.number.int({ min: 1, max: 3 });
          for (let k = 0; k < numItems; k++) {
            const med = faker.helpers.arrayElement(createdMedicines);
            await prescriptionItemRepo.save(
              prescriptionItemRepo.create({
                prescriptionId: prescription.id,
                medicineId: med.id, // Link to Medicine
                medicineName: med.name,
                unit: med.unit,
                dosage: med.content || 'Theo chỉ định',
                frequency: '2 lần/ngày, sáng 1 chiều 1', // Complex freq
                durationDays: faker.number.int({ min: 3, max: 7 }),
                quantity: faker.number.int({ min: 10, max: 20 }),
                startDate: new Date(),
                endDate: faker.date.soon({ days: 7 }),
                instructions: 'Uống sau ăn',
              }),
            );
          }
        }
      }
    }
    console.log(`   ✅ ${appsCreated} Appointments & Medical Records created.`);

    // ========== GENERATE TIME SLOTS (60 Days) ==========
    console.log('\n⏳ Generating TimeSlots (60 Days)...');
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 60);

    let slotsGenerated = 0;

    for (const doctor of createdDoctors) {
      const iterDate = new Date(startDate);
      while (iterDate <= futureDate) {
        const dayOfWeek = iterDate.getDay();

        const dayStart = new Date(iterDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(iterDate);
        dayEnd.setHours(23, 59, 59, 999);

        const specialSchedules = await scheduleRepo.find({
          where: {
            doctorId: doctor.id,
            specificDate: Between(dayStart, dayEnd),
            priority: MoreThan(0),
          },
          order: { priority: 'DESC' },
        });

        const regularSchedules = await scheduleRepo.find({
          where: {
            doctorId: doctor.id,
            scheduleType: ScheduleType.REGULAR,
            dayOfWeek: dayOfWeek,
            isAvailable: true,
          },
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

          const rangeStart = new Date(iterDate);
          rangeStart.setHours(sH, sM, 0, 0);
          const rangeEnd = new Date(iterDate);
          rangeEnd.setHours(eH, eM, 0, 0);

          let curr = rangeStart.getTime();
          while (curr + slotDurMs <= rangeEnd.getTime()) {
            const slotStart = new Date(curr);
            const slotEnd = new Date(curr + slotDurMs);

            const existingApp = await appointmentRepo.findOne({
              where: {
                doctorId: doctor.id,
                scheduledAt: slotStart, // Fix: dateTime -> scheduledAt
              },
            });

            await timeSlotRepo.save(
              timeSlotRepo.create({
                doctorId: doctor.id,
                scheduleId: sched.id,
                startTime: slotStart,
                endTime: slotEnd,
                isAvailable: !existingApp,
                capacity: sched.slotCapacity,
                bookedCount: existingApp ? 1 : 0,
              }),
            );
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
    if (dataSource.isInitialized) await dataSource.destroy();
    process.exit(1);
  }
}

void seed();
