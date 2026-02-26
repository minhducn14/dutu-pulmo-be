import { DataSource, MoreThan, Between } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { fakerVI as faker } from '@faker-js/faker';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Core Imports (we can keep these for explicit usage in code)
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
import { VitalSign } from '@/modules/medical/entities/vital-sign.entity';
import { ScreeningRequest } from '@/modules/screening/entities/screening-request.entity';
import { MedicalImage } from '@/modules/screening/entities/medical-image.entity';
import { AiAnalysis } from '@/modules/screening/entities/ai-analysis.entity';
import { ScreeningConclusion } from '@/modules/screening/entities/screening-conclusion.entity';
import {
  Payment,
  PaymentStatus,
} from '@/modules/payment/entities/payment.entity';
import { Review } from '@/modules/review/entities/review.entity';
import { Favorite } from '@/modules/favorite/entities/favorite.entity';
import { ChatRoom } from '@/modules/chatroom/entities/chatroom.entity';
import { ChatMessage } from '@/modules/chatmessage/entities/chatmessage.entity';
import { Notification } from '@/modules/notification/entities/notification.entity';
import {
  Report,
  ReportType,
  ReportStatus,
} from '@/modules/report/entities/report.entity';

// Enums
import { DoctorTitle } from '@/modules/common/enums/doctor-title.enum';
import { SpecialtyEnum } from '@/modules/common/enums/specialty.enum';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { UserStatusEnum } from '@/modules/common/enums/user-status.enum';
import { ScheduleType } from '@/modules/common/enums/schedule-type.enum';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { GenderEnum } from '@/modules/common/enums/gender.enum';
import { PrescriptionStatusEnum } from '@/modules/common/enums/prescription-status.enum';
import { ScreeningStatusEnum } from '@/modules/common/enums/screening-status.enum';
import { ScreeningTypeEnum } from '@/modules/common/enums/screening-type.enum';
import { ScreeningPriorityEnum } from '@/modules/common/enums/screening-priority.enum';
import { AiDiagnosisStatusEnum } from '@/modules/common/enums/ai-diagnosis-status.enum';
import { NotificationTypeEnum } from '@/modules/common/enums/notification-type.enum';
import { StatusEnum } from '@/modules/common/enums/status.enum';
import { PaymentPurpose } from '@/modules/common/enums/payment-purpose.enum';
import {
  GoodsType,
  MedicineGroup,
  RouteOfAdministration,
  UnitOfMeasure,
} from '@/modules/medical/enums/medicine.enums';

import {
  vnNow,
  startOfDayVN,
  endOfDayVN,
  addDaysVN,
  getDayVN,
} from '@/common/datetime';

// ========== DATA POOLS - Chuyên khoa phổi ==========

const PULMO_COMPLAINTS = [
  'Ho kéo dài hơn 2 tuần, ho có đờm',
  'Khó thở khi gắng sức, tăng dần 1 tháng',
  'Đau ngực bên trái khi hít sâu',
  'Sốt cao kèm ho có đờm vàng xanh',
  'Thở khò khè về đêm, khó ngủ',
  'Ho ra máu lần đầu',
  'Tức ngực, cảm giác nặng ngực kéo dài',
  'Khó thở đột ngột kèm sốt cao',
  'Ho khan kéo dài, không đáp ứng thuốc ho thông thường',
  'Sụt cân không rõ nguyên nhân kèm ho mạn tính',
  'Khó thở tăng dần, phù chân',
  'Ho nhiều đờm buổi sáng kèm mệt mỏi',
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PULMO_SYMPTOMS = [
  'Ho có đờm',
  'Ho khan',
  'Khó thở',
  'Thở khò khè',
  'Đau ngực',
  'Sốt',
  'Mệt mỏi',
  'Sụt cân',
  'Ra mồ hôi đêm',
  'Tức ngực',
  'Ho ra máu',
  'Đau họng',
  'Chảy mũi',
  'Khó thở khi nằm',
  'Thở nhanh',
  'Tím tái',
];

const PULMO_DIAGNOSES = [
  'Viêm phế quản cấp (J20)',
  'COPD giai đoạn II - trung bình (J44.1)',
  'Hen phế quản mức độ nhẹ, dai dẳng (J45.2)',
  'Viêm phổi cộng đồng (J18.9)',
  'Lao phổi AFB(+) (A15.0)',
  'Tràn dịch màng phổi (J91)',
  'U phổi cần theo dõi (R91.1)',
  'Giãn phế quản (J47)',
  'Viêm phổi do virus (J12.9)',
  'Hen phế quản cơn cấp (J46)',
  'Nhiễm trùng đường hô hấp trên (J06.9)',
  'Xơ phổi (J84.1)',
];

const MEDICAL_HISTORIES = [
  'Tiền sử hen phế quản từ nhỏ',
  'Hút thuốc lá 15 năm, đã bỏ 2 năm',
  'COPD phát hiện 3 năm, đang điều trị',
  'Lao phổi đã điều trị khỏi 2020',
  'Tiền sử dị ứng thời tiết',
  'Không có tiền sử bệnh lý đặc biệt',
  'Tăng huyết áp đang điều trị',
  'Đái tháo đường type 2',
  'Tiền sử viêm phổi tái phát',
  'Hút thuốc lá 20 năm, chưa bỏ',
];

const COMMON_ALLERGIES = [
  'Penicillin',
  'Bụi nhà',
  'Phấn hoa',
  'Aspirin',
  'Sulfamid',
  'Hải sản',
  'Lông động vật',
];

const REVIEW_COMMENTS = [
  'Bác sĩ rất tận tâm, giải thích rõ ràng tình trạng bệnh.',
  'Khám nhanh nhưng vẫn kỹ lưỡng. Rất hài lòng.',
  'Phòng khám sạch sẽ, nhân viên thân thiện.',
  'Bác sĩ lắng nghe bệnh nhân, tư vấn thuốc cẩn thận.',
  'Thời gian chờ hơi lâu nhưng chất lượng khám tốt.',
  'Bác sĩ chuyên môn cao, chẩn đoán chính xác.',
  'Rất tin tưởng bác sĩ, sẽ quay lại tái khám.',
  'Khám lần đầu, cảm thấy yên tâm với cách tư vấn.',
];

const CHAT_MESSAGES_DOCTOR = [
  'Chào anh/chị, tôi đã xem kết quả. Tình trạng phổi ổn định.',
  'Anh/chị nhớ uống thuốc đúng liều nhé.',
  'Kết quả xét nghiệm đã có, mời anh/chị đến tái khám.',
  'Tình trạng cải thiện tốt, tiếp tục duy trì phác đồ.',
];

const CHAT_MESSAGES_PATIENT = [
  'Dạ em cảm ơn bác sĩ. Em uống thuốc đều.',
  'Bác sĩ ơi, em vẫn còn ho nhiều, có sao không ạ?',
  'Em muốn đặt lịch tái khám tuần sau được không ạ?',
  'Dạ em đã uống hết thuốc rồi, bao giờ cần khám lại ạ?',
];

const AI_PRIMARY_DIAGNOSES = [
  {
    label: 'Lung Opacity',
    name_vn: 'Mờ phổi',
    risk_level: 'MEDIUM',
    confidence_level: 'HIGH',
    recommendation: 'Cần theo dõi thêm, chụp CT nếu không cải thiện sau 2 tuần',
    color: '#FFA500',
    probability: 0.82,
  },
  {
    label: 'Pleural Effusion',
    name_vn: 'Tràn dịch màng phổi',
    risk_level: 'HIGH',
    confidence_level: 'HIGH',
    recommendation: 'Cần chọc dịch xét nghiệm, theo dõi sát',
    color: '#FF4444',
    probability: 0.91,
  },
  {
    label: 'Normal',
    name_vn: 'Bình thường',
    risk_level: 'LOW',
    confidence_level: 'HIGH',
    recommendation: 'Không phát hiện bất thường, tái khám định kỳ',
    color: '#4CAF50',
    probability: 0.95,
  },
];

const AI_FINDINGS_POOL = [
  {
    label: 'Consolidation',
    name_vn: 'Đông đặc phổi',
    probability: 0.78,
    risk_level: 'MEDIUM',
    confidence_level: 'HIGH',
    recommendation: 'Nghi viêm phổi, cần xét nghiệm thêm',
  },
  {
    label: 'Cardiomegaly',
    name_vn: 'Tim to',
    probability: 0.65,
    risk_level: 'MEDIUM',
    confidence_level: 'MEDIUM',
    recommendation: 'Cần siêu âm tim bổ sung',
  },
  {
    label: 'Nodule',
    name_vn: 'Nốt phổi',
    probability: 0.55,
    risk_level: 'HIGH',
    confidence_level: 'MEDIUM',
    recommendation: 'Theo dõi sát, chụp CT lát mỏng',
  },
];

/**
 * Seed data cho hệ thống phòng khám phổi Dutu Pulmo (Comprehensive - 1 Month+ Test)
 * Run: npx ts-node -r tsconfig-paths/register src/modules/core/database/seeds/seed.ts
 */

async function seed() {
  dotenv.config();

  // Path to all entities: src/modules/**/*.entity.ts
  // seed.ts is in src/modules/core/database/seeds/
  // So we go up 4 levels to src/modules
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
    const vitalSignRepo = dataSource.getRepository(VitalSign);
    const screeningRepo = dataSource.getRepository(ScreeningRequest);
    const medicalImageRepo = dataSource.getRepository(MedicalImage);
    const aiAnalysisRepo = dataSource.getRepository(AiAnalysis);
    const screeningConclusionRepo =
      dataSource.getRepository(ScreeningConclusion);
    const paymentRepo = dataSource.getRepository(Payment);
    const reviewRepo = dataSource.getRepository(Review);
    const favoriteRepo = dataSource.getRepository(Favorite);
    const chatRoomRepo = dataSource.getRepository(ChatRoom);
    const chatMessageRepo = dataSource.getRepository(ChatMessage);
    const notificationRepo = dataSource.getRepository(Notification);
    const reportRepo = dataSource.getRepository(Report);

    // ========== SEED HOSPITALS ==========
    console.log('\n🏥 Seeding Hospitals...');
    const hospitals = [
      {
        name: 'Bệnh viện Phổi Trung ương',
        code: 'BVPTW',
        address: '463 Hoàng Hoa Thám, Tây Hồ, Hà Nội',
        phone: '024 3762 5001',
        lat: 21.0556,
        long: 105.8145,
      },
      {
        name: 'Bệnh viện Phổi TP. Hồ Chí Minh',
        code: 'BVPHCM',
        address: '587 Huỳnh Văn Bánh, Phú Nhuận, TP.HCM',
        phone: '028 3844 2104',
        lat: 10.7985,
        long: 106.6736,
      },
      {
        name: 'Bệnh viện Lao và Bệnh phổi Cần Thơ',
        code: 'BVLBPCT',
        address: '89 Trần Hưng Đạo, Ninh Kiều, Cần Thơ',
        phone: '0292 382 1345',
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
          phone: h.phone,
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

    // ========== SEED RECEPTIONIST ==========
    const receptionEmail = 'reception@dutupulmo.vn';
    const receptionAccount = await accountRepo.findOne({
      where: { email: receptionEmail },
    });
    if (!receptionAccount) {
      const receptionUser = await userRepo.save(
        userRepo.create({
          fullName: 'Lễ tân',
          status: UserStatusEnum.ACTIVE,
        }),
      );
      await accountRepo.save(
        accountRepo.create({
          email: receptionEmail,
          password: await bcrypt.hash(
            process.env.RECEPTION_PASSWORD || 'Reception@123',
            12,
          ),
          roles: [RoleEnum.RECEPTIONIST],
          isVerified: true,
          userId: receptionUser.id,
        }),
      );
      console.log('   ✅ Reception account created.');
    } else {
      console.log('   ℹ️ Reception account exists.');
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
        manufacturer: 'GlaxoSmithKline',
        countryOfOrigin: 'Anh',
        guide: 'Uống sau ăn, cách nhau 12 giờ. Không nhai viên thuốc.',
        registrationNumber: 'VN-20145-17',
      },
      {
        name: 'Zinnat 500mg',
        activeIngredient: 'Cefuroxime',
        content: '500mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.ANTIBIOTICS,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 1 vỉ x 10 viên',
        manufacturer: 'GlaxoSmithKline',
        countryOfOrigin: 'Anh',
        guide: 'Uống ngay sau bữa ăn để tăng hấp thu.',
        registrationNumber: 'VN-18234-14',
      },
      {
        name: 'Ventolin Nebules',
        activeIngredient: 'Salbutamol',
        content: '2.5mg/2.5ml',
        unit: UnitOfMeasure.AMPOULE,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.NEBULIZATION,
        packing: 'Hộp 30 ống',
        manufacturer: 'GlaxoSmithKline',
        countryOfOrigin: 'Pháp',
        guide: 'Khí dung qua máy nebulizer. Dùng khi lên cơn khó thở.',
        registrationNumber: 'VN-21567-18',
      },
      {
        name: 'Seretide Evohaler',
        activeIngredient: 'Salmeterol + Fluticasone',
        content: '25/125mcg',
        unit: UnitOfMeasure.BOTTLE,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.INHALATION,
        packing: 'Hộp 1 bình 120 liều',
        manufacturer: 'GlaxoSmithKline',
        countryOfOrigin: 'Tây Ban Nha',
        guide: 'Hít 2 nhát/lần, 2 lần/ngày. Súc miệng sau khi dùng.',
        registrationNumber: 'VN-19876-16',
      },
      {
        name: 'Symbicort Turbuhaler',
        activeIngredient: 'Budesonide + Formoterol',
        content: '160/4.5mcg',
        unit: UnitOfMeasure.BOTTLE,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.INHALATION,
        packing: 'Hộp 1 bình 60 liều',
        manufacturer: 'AstraZeneca',
        countryOfOrigin: 'Thụy Điển',
        guide: 'Hít 1-2 nhát/lần, 2 lần/ngày. Súc miệng sau khi hít.',
        registrationNumber: 'VN-22341-19',
      },
      {
        name: 'Medrol 16mg',
        activeIngredient: 'Methylprednisolone',
        content: '16mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.HORMONES,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 3 vỉ x 10 viên',
        manufacturer: 'Pfizer',
        countryOfOrigin: 'Ý',
        guide: 'Uống sau ăn sáng. Không ngưng đột ngột.',
        registrationNumber: 'VN-17890-13',
      },
      {
        name: 'Solu-Medrol 40mg',
        activeIngredient: 'Methylprednisolone',
        content: '40mg',
        unit: UnitOfMeasure.VIAL,
        group: MedicineGroup.HORMONES,
        route: RouteOfAdministration.INJECTION,
        packing: 'Hộp 1 lọ',
        manufacturer: 'Pfizer',
        countryOfOrigin: 'Bỉ',
        guide: 'Tiêm tĩnh mạch chậm. Chỉ dùng theo chỉ định bác sĩ.',
        registrationNumber: 'VN-16543-12',
      },
      {
        name: 'Acemuc 200mg',
        activeIngredient: 'Acetylcysteine',
        content: '200mg',
        unit: UnitOfMeasure.PACKET,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 30 gói',
        manufacturer: 'Sanofi',
        countryOfOrigin: 'Việt Nam',
        guide: 'Pha gói thuốc vào nửa ly nước, uống sau ăn. Uống nhiều nước.',
        registrationNumber: 'VN-23456-20',
      },
      {
        name: 'Bisolvon 8mg',
        activeIngredient: 'Bromhexine',
        content: '8mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 30 viên',
        manufacturer: 'Boehringer Ingelheim',
        countryOfOrigin: 'Đức',
        guide: 'Uống sau ăn, 3 lần/ngày. Uống nhiều nước để long đờm.',
        registrationNumber: 'VN-18901-15',
      },
      {
        name: 'Panadol Extra',
        activeIngredient: 'Paracetamol + Caffeine',
        content: '500mg + 65mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.NSAIDS,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 15 vỉ x 12 viên',
        manufacturer: 'GlaxoSmithKline',
        countryOfOrigin: 'Ireland',
        guide: 'Uống khi đau hoặc sốt, cách mỗi 4-6 giờ. Tối đa 8 viên/ngày.',
        registrationNumber: 'VN-15678-11',
      },
      {
        name: 'Efferalgan 500mg',
        activeIngredient: 'Paracetamol',
        content: '500mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.NSAIDS,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 16 viên sủi',
        manufacturer: 'Bristol-Myers Squibb',
        countryOfOrigin: 'Pháp',
        guide: 'Hòa tan 1 viên trong ly nước, uống khi sủi hết. Cách 4-6 giờ.',
        registrationNumber: 'VN-14567-10',
      },
      {
        name: 'Aerius 5mg',
        activeIngredient: 'Desloratadine',
        content: '5mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 1 vỉ x 10 viên',
        manufacturer: 'Bayer',
        countryOfOrigin: 'Bỉ',
        guide: 'Uống 1 viên/ngày, bất kỳ lúc nào.',
        registrationNumber: 'VN-20987-17',
      },
      {
        name: 'Singulair 10mg',
        activeIngredient: 'Montelukast',
        content: '10mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 4 vỉ x 7 viên',
        manufacturer: 'MSD',
        countryOfOrigin: 'Mỹ',
        guide: 'Uống 1 viên buổi tối trước khi ngủ.',
        registrationNumber: 'VN-19234-16',
      },
      {
        name: 'Spiriva Respimat',
        activeIngredient: 'Tiotropium',
        content: '2.5mcg',
        unit: UnitOfMeasure.BOTTLE,
        group: MedicineGroup.ASTHMA,
        route: RouteOfAdministration.INHALATION,
        packing: 'Hộp 1 bình 60 nhát',
        manufacturer: 'Boehringer Ingelheim',
        countryOfOrigin: 'Đức',
        guide: 'Hít 2 nhát/lần, 1 lần/ngày vào cùng giờ mỗi ngày.',
        registrationNumber: 'VN-21890-18',
      },
      {
        name: 'Klacid 500mg',
        activeIngredient: 'Clarithromycin',
        content: '500mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.ANTIBIOTICS,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 1 vỉ x 14 viên',
        manufacturer: 'Abbott',
        countryOfOrigin: 'Ý',
        guide: 'Uống cách nhau 12 giờ, có thể uống khi no hoặc đói.',
        registrationNumber: 'VN-17654-13',
      },
      {
        name: 'Nexium 40mg',
        activeIngredient: 'Esomeprazole',
        content: '40mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.GASTRIC_ULCER,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 2 vỉ x 7 viên',
        manufacturer: 'AstraZeneca',
        countryOfOrigin: 'Thụy Điển',
        guide: 'Uống trước ăn 30 phút, nuốt nguyên viên, không nhai.',
        registrationNumber: 'VN-16789-12',
      },
      {
        name: 'Rifampicin 300mg',
        activeIngredient: 'Rifampicin',
        content: '300mg',
        unit: UnitOfMeasure.CAPSULE,
        group: MedicineGroup.TUBERCULOSIS,
        route: RouteOfAdministration.ORAL,
        packing: 'Hộp 10 vỉ x 10 viên',
        manufacturer: 'Sanofi',
        countryOfOrigin: 'Ấn Độ',
        guide: 'Uống lúc đói, 1 giờ trước ăn hoặc 2 giờ sau ăn.',
        registrationNumber: 'VN-13456-09',
      },
      {
        name: 'Ethambutol 400mg',
        activeIngredient: 'Ethambutol',
        content: '400mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.TUBERCULOSIS,
        route: RouteOfAdministration.ORAL,
        packing: 'Lọ 100 viên',
        manufacturer: 'Mylan',
        countryOfOrigin: 'Ấn Độ',
        guide: 'Uống 1 lần/ngày sau bữa ăn. Theo dõi thị lực định kỳ.',
        registrationNumber: 'VN-12345-08',
      },
      {
        name: 'Pyrazinamide 500mg',
        activeIngredient: 'Pyrazinamide',
        content: '500mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.TUBERCULOSIS,
        route: RouteOfAdministration.ORAL,
        packing: 'Vỉ 10 viên',
        manufacturer: 'Pharmtechnology',
        countryOfOrigin: 'Belarus',
        guide: 'Uống sau ăn, 1 lần/ngày. Kiểm tra chức năng gan định kỳ.',
        registrationNumber: 'VN-14890-10',
      },
      {
        name: 'Isoniazid 300mg',
        activeIngredient: 'Isoniazid',
        content: '300mg',
        unit: UnitOfMeasure.TABLET,
        group: MedicineGroup.TUBERCULOSIS,
        route: RouteOfAdministration.ORAL,
        packing: 'Lọ 100 viên',
        manufacturer: 'Macleods',
        countryOfOrigin: 'Ấn Độ',
        guide: 'Uống lúc đói. Bổ sung Vitamin B6 kèm theo.',
        registrationNumber: 'VN-11234-07',
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
        name: 'BS. Nguyễn Văn Minh',
        email: 'respiratory@dutupulmo.vn',
        phone: '0901 234 567',
        gender: GenderEnum.MALE,
        spec: SpecialtyEnum.RESPIRATORY_MEDICINE,
        licenseNumber: 'LIC-HN2018',
        yearsOfExperience: 15,
        bio: 'Chuyên gia Nội Hô hấp với hơn 15 năm kinh nghiệm tại BV Phổi Trung ương. Chuyên sâu điều trị COPD, hen phế quản và viêm phổi.',
        fee: '500000',
      },
      {
        name: 'BS. Trần Thị Lan',
        email: 'pulmo@dutupulmo.vn',
        phone: '0912 345 678',
        gender: GenderEnum.FEMALE,
        spec: SpecialtyEnum.PULMONOLOGY,
        licenseNumber: 'LIC-HCM2016',
        yearsOfExperience: 12,
        bio: 'Bác sĩ chuyên khoa Phổi, tốt nghiệp ĐH Y Dược TP.HCM. Chuyên điều trị bệnh lý phổi mạn tính và u phổi.',
        fee: '450000',
      },
      {
        name: 'PGS. Lê Hoàng Nam',
        email: 'thoracic@dutupulmo.vn',
        phone: '0923 456 789',
        gender: GenderEnum.MALE,
        spec: SpecialtyEnum.THORACIC_SURGERY,
        licenseNumber: 'LIC-HN2010',
        yearsOfExperience: 20,
        bio: 'Phó Giáo sư, Tiến sĩ Ngoại Lồng ngực. 20 năm kinh nghiệm phẫu thuật lồng ngực và nội soi phổi.',
        fee: '800000',
      },
      {
        name: 'BS. Phạm Thị Hương',
        email: 'tuberculosis@dutupulmo.vn',
        phone: '0934 567 890',
        gender: GenderEnum.FEMALE,
        spec: SpecialtyEnum.TUBERCULOSIS,
        licenseNumber: 'LIC-CT2015',
        yearsOfExperience: 10,
        bio: 'Bác sĩ chuyên khoa Lao, kinh nghiệm 10 năm điều trị lao phổi và lao đa kháng thuốc.',
        fee: '400000',
      },
      {
        name: 'TS. Võ Đình Tuấn',
        email: 'surgery@dutupulmo.vn',
        phone: '0945 678 901',
        gender: GenderEnum.MALE,
        spec: SpecialtyEnum.THORACIC_SURGERY,
        licenseNumber: 'LIC-HN2012',
        yearsOfExperience: 18,
        bio: 'Tiến sĩ Y khoa, chuyên phẫu thuật lồng ngực. Nghiên cứu và điều trị ung thư phổi giai đoạn sớm.',
        fee: '700000',
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
            phone: ds.phone,
            gender: ds.gender,
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
            licenseNumber: ds.licenseNumber,
            title: DoctorTitle.SPECIALIST_DOCTOR_1,
            specialty: ds.spec,
            yearsOfExperience: ds.yearsOfExperience,
            bio: ds.bio,
            defaultConsultationFee: ds.fee,
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

      const offDaysFromNow = [7, 14, 21];
      for (const daysFromNow of offDaysFromNow) {
        const date = addDaysVN(vnNow(), daysFromNow);
        await scheduleRepo.save(
          scheduleRepo.create({
            doctorId: doctor.id,
            scheduleType: ScheduleType.TIME_OFF,
            priority: 100,
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
    const completedRecords: {
      record: MedicalRecord;
      appointment: Appointment;
      patient: Patient;
      doctor: Doctor;
    }[] = [];
    const paidAppointments: { appointment: Appointment; patient: Patient }[] =
      [];

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
          chiefComplaint: faker.helpers.arrayElement(PULMO_COMPLAINTS),
          feeAmount: doctor.defaultConsultationFee || '0',
        }),
      );
      appsCreated++;

      // Track CONFIRMED/CHECKED_IN for payment seeding (paid to book)
      if (
        status === AppointmentStatusEnum.CONFIRMED ||
        status === AppointmentStatusEnum.CHECKED_IN
      ) {
        paidAppointments.push({ appointment, patient });
      }

      // ========== MEDICAL RECORDS (For COMPLETED) ==========
      if (status === AppointmentStatusEnum.COMPLETED) {
        const record = await medicalRecordRepo.save(
          medicalRecordRepo.create({
            appointmentId: appointment.id,
            patientId: patient.id,
            doctorId: doctor.id,
            recordNumber: `REC-${appointment.appointmentNumber || faker.string.alphanumeric(6)}-${faker.string.alphanumeric(4)}`,
            diagnosis: faker.helpers.arrayElement(PULMO_DIAGNOSES),
            chiefComplaint: faker.helpers.arrayElement(PULMO_COMPLAINTS),
            medicalHistory: faker.helpers.arrayElement(MEDICAL_HISTORIES),
            allergies: faker.helpers.arrayElements(COMMON_ALLERGIES, {
              min: 0,
              max: 2,
            }),
          }),
        );
        completedRecords.push({ record, appointment, patient, doctor });
        paidAppointments.push({ appointment, patient });

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

    // ========== GUARANTEED TEST DATA (For Queue Manager) ==========
    console.log('\n🧪 Creating Guaranteed Test Appointment...');
    if (createdDoctors.length > 0 && allPatients.length > 0) {
      const testDoctor = createdDoctors[0]; // Dr. Respiratory
      const testPatient = allPatients[0];

      const testDate = new Date();
      testDate.setHours(9, 0, 0, 0); // 9:00 AM Today

      await appointmentRepo.save(
        appointmentRepo.create({
          doctorId: testDoctor.id,
          patientId: testPatient.id,
          scheduledAt: testDate,
          durationMinutes: 30,
          status: AppointmentStatusEnum.CHECKED_IN, // Ready to Start Exam
          appointmentType: AppointmentTypeEnum.IN_CLINIC,
          appointmentNumber: `TEST-QUEUE-01`,
          chiefComplaint: 'Testing Queue Manager - Start Exam Flow',
          feeAmount: testDoctor.defaultConsultationFee || '0',
        }),
      );
      console.log(
        `   ✅ Created TEST-QUEUE-01: CHECKED_IN for ${testDoctor.userId} (Dr. Respiratory)`,
      );

      const videoDate = new Date();
      videoDate.setHours(10, 0, 0, 0); // 10:00 AM Today

      await appointmentRepo.save(
        appointmentRepo.create({
          doctorId: testDoctor.id,
          patientId: testPatient.id,
          scheduledAt: videoDate,
          durationMinutes: 30,
          status: AppointmentStatusEnum.CHECKED_IN, // Ready to Join
          appointmentType: AppointmentTypeEnum.VIDEO,
          appointmentNumber: `TEST-VIDEO-01`,
          chiefComplaint: 'Testing Video Call Flow',
          feeAmount: testDoctor.defaultConsultationFee || '0',
        }),
      );
      console.log(
        `   ✅ Created TEST-VIDEO-01: CHECKED_IN (Video) for ${testDoctor.userId}`,
      );

      // TEST VIDEO 2: CONFIRMED (Not yet checked in)
      const videoDate2 = new Date();
      videoDate2.setHours(14, 0, 0, 0); // 2:00 PM Today

      await appointmentRepo.save(
        appointmentRepo.create({
          doctorId: testDoctor.id,
          patientId: testPatient.id,
          scheduledAt: videoDate2,
          durationMinutes: 30,
          status: AppointmentStatusEnum.CONFIRMED,
          appointmentType: AppointmentTypeEnum.VIDEO,
          appointmentNumber: `TEST-VIDEO-02`,
          chiefComplaint: 'Video Call Test 2 - Confirmed Status',
          feeAmount: testDoctor.defaultConsultationFee || '0',
        }),
      );
      console.log(`   ✅ Created TEST-VIDEO-02: CONFIRMED (Video)`);

      // TEST VIDEO 3: CHECKED_IN (Another ready one)
      const videoDate3 = new Date();
      videoDate3.setHours(15, 30, 0, 0); // 3:30 PM Today

      await appointmentRepo.save(
        appointmentRepo.create({
          doctorId: testDoctor.id,
          patientId: testPatient.id,
          scheduledAt: videoDate3,
          durationMinutes: 30,
          status: AppointmentStatusEnum.CHECKED_IN,
          appointmentType: AppointmentTypeEnum.VIDEO,
          appointmentNumber: `TEST-VIDEO-03`,
          chiefComplaint: 'Video Call Test 3 - Checked In',
          feeAmount: testDoctor.defaultConsultationFee || '0',
        }),
      );
      console.log(`   ✅ Created TEST-VIDEO-03: CHECKED_IN (Video)`);
    }

    // ========== SEED VITAL SIGNS ==========
    console.log('\n🩺 Seeding VitalSigns...');
    let vitalsCreated = 0;
    for (const { record, patient } of completedRecords) {
      await vitalSignRepo.save(
        vitalSignRepo.create({
          patientId: patient.id,
          medicalRecordId: record.id,
          height: faker.number.int({ min: 150, max: 185 }),
          weight: faker.number.int({ min: 45, max: 90 }),
          temperature: parseFloat(
            faker.number
              .float({ min: 36.0, max: 37.5, fractionDigits: 1 })
              .toFixed(1),
          ),
          bloodPressure: `${faker.number.int({ min: 90, max: 140 })}/${faker.number.int({ min: 60, max: 90 })}`,
          heartRate: faker.number.int({ min: 60, max: 100 }),
          respiratoryRate: faker.number.int({ min: 12, max: 20 }),
          spo2: faker.number.int({ min: 94, max: 100 }),
        }),
      );
      vitalsCreated++;
    }
    console.log(`   ✅ ${vitalsCreated} VitalSigns created.`);

    // ========== SEED SCREENING CHAIN (50% of completed records) ==========
    console.log('\n🔬 Seeding Screening Requests + Images + AI Analysis...');
    let screeningsCreated = 0;
    const screeningRecords = completedRecords.filter(() => Math.random() < 0.5);

    for (let i = 0; i < screeningRecords.length; i++) {
      const { record, patient, doctor } = screeningRecords[i];
      const now = new Date();

      // ScreeningRequest
      const screening = await screeningRepo.save(
        screeningRepo.create({
          medicalRecordId: record.id,
          patientId: patient.id,
          uploadedByDoctorId: doctor.id,
          screeningNumber: `SCR-${faker.string.alphanumeric(8).toUpperCase()}`,
          screeningType: ScreeningTypeEnum.XRAY,
          status: ScreeningStatusEnum.DOCTOR_COMPLETED,
          priority: ScreeningPriorityEnum.NORMAL,
          requestedAt: new Date(now.getTime() - 3600000),
          uploadedAt: new Date(now.getTime() - 3000000),
          aiStartedAt: new Date(now.getTime() - 2400000),
          aiCompletedAt: new Date(now.getTime() - 1800000),
        }),
      );

      // MedicalImage
      const image = await medicalImageRepo.save(
        medicalImageRepo.create({
          screeningId: screening.id,
          fileUrl: `https://res.cloudinary.com/dutupulmo/image/upload/v1/xrays/sample_xray_${i + 1}.jpg`,
          thumbnailUrl: `https://res.cloudinary.com/dutupulmo/image/upload/w_200/v1/xrays/sample_xray_${i + 1}.jpg`,
          fileName: `xray_patient_${patient.id.slice(0, 6)}.jpg`,
          fileSize: 2048000,
          mimeType: 'image/jpeg',
          width: 2048,
          height: 2048,
        }),
      );

      // AiAnalysis
      const primaryDx = faker.helpers.arrayElement(AI_PRIMARY_DIAGNOSES);
      const numFindings =
        primaryDx.label === 'Normal' ? 0 : faker.number.int({ min: 1, max: 3 });
      const findings =
        numFindings > 0
          ? faker.helpers.arrayElements(AI_FINDINGS_POOL, numFindings)
          : [];

      const analysis = await aiAnalysisRepo.save(
        aiAnalysisRepo.create({
          screeningId: screening.id,
          medicalImageId: image.id,
          diagnosisStatus:
            primaryDx.label === 'Normal'
              ? AiDiagnosisStatusEnum.DETECTED
              : AiDiagnosisStatusEnum.DETECTED,
          primaryDiagnosis: primaryDx,
          findings: findings,
          grayZoneNotes: [],
          totalFindings: findings.length,
          originalImageUrl: image.fileUrl,
          annotatedImageUrl: `https://res.cloudinary.com/dutupulmo/image/upload/v1/xrays/annotated_xray_${i + 1}.jpg`,
        }),
      );

      // ScreeningConclusion
      const agreesWithAi = Math.random() < 0.8;
      await screeningConclusionRepo.save(
        screeningConclusionRepo.create({
          screeningId: screening.id,
          aiAnalysisId: analysis.id,
          medicalRecordId: record.id,
          patientId: patient.id,
          doctorId: doctor.id,
          agreesWithAi,
          decisionSource: 'DOCTOR_REVIEWED_AI' as const,
          doctorOverrideReason: agreesWithAi
            ? undefined
            : 'Hình ảnh chưa đủ rõ, cần chụp lại hoặc bổ sung CT',
        }),
      );

      screeningsCreated++;
    }
    console.log(`   ✅ ${screeningsCreated} Screening chains created.`);

    // ========== SEED PAYMENTS ==========
    console.log('\n💳 Seeding Payments...');
    let paymentsCreated = 0;
    for (let i = 0; i < paidAppointments.length; i++) {
      const { appointment, patient } = paidAppointments[i];
      const patientUser = await userRepo.findOne({
        where: { id: patient.userId },
      });

      await paymentRepo.save(
        paymentRepo.create({
          appointmentId: appointment.id,
          orderCode: String(Date.now() + i),
          amount: String(Math.round(Number(appointment.feeAmount ?? 500000))),
          description: `Thanh toán lịch hẹn ${appointment.appointmentNumber}`,
          status: PaymentStatus.PAID,
          purpose: PaymentPurpose.APPOINTMENT,
          paidAt: new Date(appointment.scheduledAt.getTime() - 86400000),
          buyerName: patientUser?.fullName || 'Bệnh nhân',
        }),
      );
      paymentsCreated++;
    }
    console.log(`   ✅ ${paymentsCreated} Payments created.`);

    // ========== SEED REVIEWS (60% of completed) ==========
    console.log('\n⭐ Seeding Reviews...');
    let reviewsCreated = 0;
    const reviewableRecords = completedRecords.filter(
      () => Math.random() < 0.6,
    );
    for (const { appointment, patient, doctor } of reviewableRecords) {
      await reviewRepo.save(
        reviewRepo.create({
          reviewerId: patient.userId,
          doctorId: doctor.id,
          appointmentId: appointment.id,
          rating: parseFloat(
            faker.number
              .float({ min: 3.0, max: 5.0, fractionDigits: 1 })
              .toFixed(1),
          ),
          comment: faker.helpers.arrayElement(REVIEW_COMMENTS),
          isAnonymous: Math.random() < 0.2,
        }),
      );
      reviewsCreated++;
    }
    console.log(`   ✅ ${reviewsCreated} Reviews created.`);

    // ========== SEED FAVORITES ==========
    console.log('\n❤️ Seeding Favorites...');
    const favPairs = new Set<string>();
    let favsCreated = 0;
    const targetFavs = Math.min(10, allPatients.length);
    for (let i = 0; i < targetFavs; i++) {
      const patient = allPatients[i];
      const doctor = faker.helpers.arrayElement(createdDoctors);
      const key = `${patient.userId}-${doctor.id}`;
      if (favPairs.has(key)) continue;
      favPairs.add(key);

      await favoriteRepo.save(
        favoriteRepo.create({
          userId: patient.userId,
          doctorId: doctor.id,
        }),
      );
      favsCreated++;
    }
    // Also some hospital favorites
    for (let i = 0; i < Math.min(5, allPatients.length); i++) {
      const patient = allPatients[i];
      const hospital = createdHospitals[i % createdHospitals.length];
      await favoriteRepo.save(
        favoriteRepo.create({
          userId: patient.userId,
          hospitalId: hospital.id,
        }),
      );
      favsCreated++;
    }
    console.log(`   ✅ ${favsCreated} Favorites created.`);

    // ========== SEED CHATROOMS + MESSAGES ==========
    console.log('\n💬 Seeding ChatRooms & Messages...');
    let chatsCreated = 0;
    const chatPairs = Math.min(5, completedRecords.length);
    for (let i = 0; i < chatPairs; i++) {
      const { patient, doctor } = completedRecords[i];
      const doctorUser = await userRepo.findOne({
        where: { id: doctor.userId },
      });
      const patientUser = await userRepo.findOne({
        where: { id: patient.userId },
      });
      if (!doctorUser || !patientUser) continue;

      const room = await chatRoomRepo.save(
        chatRoomRepo.create({
          user1: doctorUser,
          user2: patientUser,
        }),
      );

      // 4-6 messages alternating
      const numMessages = faker.number.int({ min: 4, max: 6 });
      for (let m = 0; m < numMessages; m++) {
        const isDoctor = m % 2 === 0;
        const baseTime = new Date();
        baseTime.setMinutes(baseTime.getMinutes() - (numMessages - m) * 30);

        await chatMessageRepo.save(
          chatMessageRepo.create({
            chatroom: room,
            sender: isDoctor ? doctorUser : patientUser,
            content: isDoctor
              ? faker.helpers.arrayElement(CHAT_MESSAGES_DOCTOR)
              : faker.helpers.arrayElement(CHAT_MESSAGES_PATIENT),
          }),
        );
      }
      chatsCreated++;
    }
    console.log(`   ✅ ${chatsCreated} ChatRooms with messages created.`);

    // ========== SEED NOTIFICATIONS ==========
    console.log('\n🔔 Seeding Notifications...');
    let notifsCreated = 0;

    // Patient notifications
    for (let i = 0; i < Math.min(10, allPatients.length); i++) {
      const patient = allPatients[i];
      await notificationRepo.save(
        notificationRepo.create({
          userId: patient.userId,
          type: NotificationTypeEnum.PAYMENT,
          title: 'Thanh toán thành công',
          content: 'Bạn đã thanh toán thành công lịch hẹn khám bệnh.',
          status: StatusEnum.COMPLETED,
          refType: 'PAYMENT',
        }),
      );
      await notificationRepo.save(
        notificationRepo.create({
          userId: patient.userId,
          type: NotificationTypeEnum.GENERAL,
          title: 'Nhắc lịch hẹn',
          content: 'Bạn có lịch hẹn khám sắp tới. Vui lòng đến đúng giờ.',
          status: StatusEnum.PENDING,
          refType: 'APPOINTMENT',
        }),
      );
      notifsCreated += 2;
    }

    // Doctor notifications
    for (const doctor of createdDoctors) {
      await notificationRepo.save(
        notificationRepo.create({
          userId: doctor.userId,
          type: NotificationTypeEnum.SYSTEM,
          title: 'Bệnh nhân mới',
          content: 'Có bệnh nhân mới đặt lịch hẹn với bạn.',
          status: StatusEnum.PENDING,
          refType: 'APPOINTMENT',
        }),
      );
      notifsCreated++;
    }
    console.log(`   ✅ ${notifsCreated} Notifications created.`);

    // ========== SEED REPORTS (2 sample) ==========
    console.log('\n🚨 Seeding Reports...');
    if (allPatients.length > 0 && createdDoctors.length > 0) {
      await reportRepo.save(
        reportRepo.create({
          reporterId: allPatients[0].userId,
          doctorId: createdDoctors[0].id,
          reportType: ReportType.DOCTOR,
          content: 'Bác sĩ cho toa thuốc không phù hợp với bệnh của tôi.',
          status: ReportStatus.PENDING,
        }),
      );
      if (completedRecords.length > 0) {
        await reportRepo.save(
          reportRepo.create({
            reporterId: allPatients[1]?.userId || allPatients[0].userId,
            appointmentId: completedRecords[0].appointment.id,
            reportType: ReportType.APPOINTMENT,
            content: 'Thời gian chờ quá lâu, hơn 2 tiếng so với lịch hẹn.',
            status: ReportStatus.PENDING,
          }),
        );
      }
      console.log('   ✅ 2 Reports created.');
    }

    // ========== GENERATE TIME SLOTS (60 Days) ==========
    console.log('\n⏳ Generating TimeSlots (60 Days)...');
    const startDate = startOfDayVN(vnNow());
    const futureDate = addDaysVN(startDate, 60);

    let slotsGenerated = 0;

    for (const doctor of createdDoctors) {
      const iterDate = new Date(startDate);
      while (iterDate <= futureDate) {
        const dayOfWeek = getDayVN(iterDate);

        const dayStart = startOfDayVN(iterDate);
        const dayEnd = endOfDayVN(iterDate);

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

          const baseDate = startOfDayVN(iterDate);
          const rangeStart = new Date(
            baseDate.getTime() + (sH * 60 + sM) * 60000,
          );
          const rangeEnd = new Date(
            baseDate.getTime() + (eH * 60 + eM) * 60000,
          );

          let curr = rangeStart.getTime();
          while (curr + slotDurMs <= rangeEnd.getTime()) {
            const slotStart = new Date(curr);
            const slotEnd = new Date(curr + slotDurMs);

            const existingApp = await appointmentRepo.findOne({
              where: {
                doctorId: doctor.id,
                scheduledAt: slotStart,
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
