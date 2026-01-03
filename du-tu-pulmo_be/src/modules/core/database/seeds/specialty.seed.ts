import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Specialty } from '../../../specialty/entities/specialty.entity';
import { SubSpecialty } from '../../../specialty/entities/sub-specialty.entity';
import { Doctor } from '../../../doctor/entities/doctor.entity';
import { Account } from '../../../account/entities/account.entity';
import { User } from '../../../user/entities/user.entity';
import { RoleEnum } from '../../../common/enums/role.enum';
import { UserStatusEnum } from '../../../common/enums/user-status.enum';

/**
 * Seed Specialty, SubSpecialty và Doctor data
 * Run: npx ts-node -r tsconfig-paths/register src/modules/core/database/seeds/specialty.seed.ts
 */

// ========== DATA ==========

const specialtiesData = [
  {
    name: 'Nội khoa',
    description: 'Chuyên khoa chẩn đoán và điều trị các bệnh nội tạng',
    displayOrder: 1,
    subSpecialties: [
      { name: 'Tim mạch', description: 'Bệnh lý tim và mạch máu' },
      { name: 'Hô hấp', description: 'Bệnh lý phổi và đường hô hấp' },
      { name: 'Tiêu hóa', description: 'Bệnh lý dạ dày, ruột, gan' },
      { name: 'Thận - Tiết niệu', description: 'Bệnh lý thận và đường tiểu' },
      { name: 'Nội tiết - Đái tháo đường', description: 'Rối loạn nội tiết, tiểu đường' },
      { name: 'Cơ xương khớp', description: 'Bệnh lý về xương khớp' },
      { name: 'Thần kinh', description: 'Bệnh lý hệ thần kinh' },
      { name: 'Huyết học', description: 'Bệnh lý về máu' },
    ],
  },
  {
    name: 'Ngoại khoa',
    description: 'Chuyên khoa phẫu thuật và can thiệp',
    displayOrder: 2,
    subSpecialties: [
      { name: 'Ngoại tổng quát', description: 'Phẫu thuật tổng quát' },
      { name: 'Ngoại tiêu hóa', description: 'Phẫu thuật đường tiêu hóa' },
      { name: 'Ngoại tim mạch', description: 'Phẫu thuật tim mạch' },
      { name: 'Ngoại thần kinh', description: 'Phẫu thuật thần kinh' },
      { name: 'Chấn thương chỉnh hình', description: 'Phẫu thuật xương khớp' },
      { name: 'Ngoại tiết niệu', description: 'Phẫu thuật tiết niệu' },
    ],
  },
  {
    name: 'Sản phụ khoa',
    description: 'Chăm sóc sức khỏe sinh sản nữ giới',
    displayOrder: 3,
    subSpecialties: [
      { name: 'Sản khoa', description: 'Thai kỳ và sinh đẻ' },
      { name: 'Phụ khoa', description: 'Bệnh lý phụ nữ' },
      { name: 'Vô sinh hiếm muộn', description: 'Điều trị vô sinh' },
      { name: 'Ung thư phụ khoa', description: 'Ung thư cơ quan sinh sản nữ' },
    ],
  },
  {
    name: 'Nhi khoa',
    description: 'Chăm sóc sức khỏe trẻ em',
    displayOrder: 4,
    subSpecialties: [
      { name: 'Nhi tổng quát', description: 'Khám chữa bệnh trẻ em' },
      { name: 'Nhi sơ sinh', description: 'Chăm sóc trẻ sơ sinh' },
      { name: 'Nhi tim mạch', description: 'Bệnh tim trẻ em' },
      { name: 'Nhi thần kinh', description: 'Bệnh thần kinh trẻ em' },
      { name: 'Nhi hô hấp', description: 'Bệnh hô hấp trẻ em' },
    ],
  },
  {
    name: 'Da liễu',
    description: 'Bệnh lý da và các bệnh lây qua đường tình dục',
    displayOrder: 5,
    subSpecialties: [
      { name: 'Da liễu tổng quát', description: 'Bệnh lý da thông thường' },
      { name: 'Thẩm mỹ da', description: 'Làm đẹp da, trẻ hóa' },
      { name: 'Bệnh xã hội', description: 'Bệnh lây qua đường tình dục' },
    ],
  },
  {
    name: 'Mắt',
    description: 'Bệnh lý mắt và thị lực',
    displayOrder: 6,
    subSpecialties: [
      { name: 'Nhãn khoa tổng quát', description: 'Khám mắt tổng quát' },
      { name: 'Khúc xạ', description: 'Cận thị, viễn thị, loạn thị' },
      { name: 'Glaucoma', description: 'Bệnh tăng nhãn áp' },
      { name: 'Đục thủy tinh thể', description: 'Phẫu thuật đục thủy tinh thể' },
      { name: 'Võng mạc', description: 'Bệnh lý võng mạc' },
    ],
  },
  {
    name: 'Tai Mũi Họng',
    description: 'Bệnh lý tai, mũi, họng',
    displayOrder: 7,
    subSpecialties: [
      { name: 'TMH tổng quát', description: 'Khám TMH tổng quát' },
      { name: 'Thính học', description: 'Bệnh lý thính giác' },
      { name: 'Mũi xoang', description: 'Viêm mũi xoang' },
      { name: 'Thanh quản', description: 'Bệnh thanh quản' },
    ],
  },
  {
    name: 'Răng Hàm Mặt',
    description: 'Nha khoa và phẫu thuật hàm mặt',
    displayOrder: 8,
    subSpecialties: [
      { name: 'Nha tổng quát', description: 'Khám răng tổng quát' },
      { name: 'Chỉnh nha', description: 'Niềng răng, chỉnh hình' },
      { name: 'Nha chu', description: 'Bệnh nướu răng' },
      { name: 'Phục hình răng', description: 'Cấy ghép, bọc răng sứ' },
      { name: 'Phẫu thuật hàm mặt', description: 'Phẫu thuật hàm mặt' },
    ],
  },
  {
    name: 'Tâm thần',
    description: 'Sức khỏe tâm thần và tâm lý',
    displayOrder: 9,
    subSpecialties: [
      { name: 'Tâm thần tổng quát', description: 'Khám tâm thần tổng quát' },
      { name: 'Trầm cảm - Lo âu', description: 'Rối loạn trầm cảm, lo âu' },
      { name: 'Nghiện chất', description: 'Điều trị nghiện' },
      { name: 'Tâm lý trị liệu', description: 'Tư vấn tâm lý' },
    ],
  },
  {
    name: 'Ung thư',
    description: 'Chẩn đoán và điều trị ung thư',
    displayOrder: 10,
    subSpecialties: [
      { name: 'Ung thư nội khoa', description: 'Hóa trị ung thư' },
      { name: 'Xạ trị', description: 'Xạ trị ung thư' },
      { name: 'Ung thư phẫu thuật', description: 'Phẫu thuật ung thư' },
    ],
  },
  {
    name: 'Y học cổ truyền',
    description: 'Đông y và y học cổ truyền',
    displayOrder: 11,
    subSpecialties: [
      { name: 'Châm cứu', description: 'Điều trị bằng châm cứu' },
      { name: 'Bấm huyệt', description: 'Trị liệu bấm huyệt' },
      { name: 'Thuốc đông y', description: 'Điều trị bằng thuốc đông y' },
    ],
  },
  {
    name: 'Phục hồi chức năng',
    description: 'Vật lý trị liệu và phục hồi',
    displayOrder: 12,
    subSpecialties: [
      { name: 'Vật lý trị liệu', description: 'Trị liệu bằng vật lý' },
      { name: 'Phục hồi sau phẫu thuật', description: 'Phục hồi sau mổ' },
      { name: 'Phục hồi thần kinh', description: 'Phục hồi chức năng thần kinh' },
    ],
  },
];

const sampleDoctors = [
  {
    email: 'bs.nguyen@telehealth.vn',
    password: 'Doctor@123',
    fullName: 'BS. Nguyễn Văn Minh',
    phone: '0901234567',
    licenseNumber: 'GPHN-2020-001234',
    title: 'Tiến sĩ',
    position: 'Trưởng khoa',
    bio: 'Hơn 20 năm kinh nghiệm trong lĩnh vực Tim mạch. Tốt nghiệp chuyên khoa 2 tại ĐH Y Hà Nội.',
    practiceStartYear: 2004,
    yearsOfExperience: 20,
    specialtyName: 'Nội khoa',
    subSpecialtyNames: ['Tim mạch', 'Hô hấp'],
  },
  {
    email: 'bs.tran@telehealth.vn',
    password: 'Doctor@123',
    fullName: 'BS. Trần Thị Lan',
    phone: '0912345678',
    licenseNumber: 'GPHN-2018-005678',
    title: 'Thạc sĩ',
    position: 'Phó khoa',
    bio: 'Chuyên gia Sản phụ khoa với 15 năm kinh nghiệm. Tốt nghiệp ĐH Y Dược TP.HCM.',
    practiceStartYear: 2009,
    yearsOfExperience: 15,
    specialtyName: 'Sản phụ khoa',
    subSpecialtyNames: ['Sản khoa', 'Vô sinh hiếm muộn'],
  },
  {
    email: 'bs.le@telehealth.vn',
    password: 'Doctor@123',
    fullName: 'BS. Lê Hoàng Nam',
    phone: '0923456789',
    licenseNumber: 'GPHN-2015-009012',
    title: 'Phó Giáo sư',
    position: 'Giám đốc trung tâm',
    bio: 'Chuyên gia đầu ngành về Ngoại thần kinh. Đào tạo tại Pháp và Mỹ.',
    practiceStartYear: 2000,
    yearsOfExperience: 24,
    specialtyName: 'Ngoại khoa',
    subSpecialtyNames: ['Ngoại thần kinh', 'Chấn thương chỉnh hình'],
  },
  {
    email: 'bs.pham@telehealth.vn',
    password: 'Doctor@123',
    fullName: 'BS. Phạm Minh Tuấn',
    phone: '0934567890',
    licenseNumber: 'GPHN-2019-003456',
    title: 'Bác sĩ CKI',
    position: 'Bác sĩ điều trị',
    bio: 'Bác sĩ Nhi khoa nhiệt tình, yêu trẻ em. 10 năm kinh nghiệm tại BV Nhi TƯ.',
    practiceStartYear: 2014,
    yearsOfExperience: 10,
    specialtyName: 'Nhi khoa',
    subSpecialtyNames: ['Nhi tổng quát', 'Nhi hô hấp'],
  },
  {
    email: 'bs.hoang@telehealth.vn',
    password: 'Doctor@123',
    fullName: 'BS. Hoàng Thu Hà',
    phone: '0945678901',
    licenseNumber: 'GPHN-2017-007890',
    title: 'Tiến sĩ',
    position: 'Trưởng khoa',
    bio: 'Chuyên gia Da liễu thẩm mỹ hàng đầu. Đào tạo tại Hàn Quốc.',
    practiceStartYear: 2007,
    yearsOfExperience: 17,
    specialtyName: 'Da liễu',
    subSpecialtyNames: ['Da liễu tổng quát', 'Thẩm mỹ da'],
  },
];

async function seedSpecialtyData() {
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
    entities: [Specialty, SubSpecialty, Doctor, Account, User],
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await dataSource.initialize();
    console.log('🔗 Database connected');

    const specialtyRepo = dataSource.getRepository(Specialty);
    const subSpecialtyRepo = dataSource.getRepository(SubSpecialty);
    const doctorRepo = dataSource.getRepository(Doctor);
    const accountRepo = dataSource.getRepository(Account);
    const userRepo = dataSource.getRepository(User);

    // ========== SEED SPECIALTIES ==========
    console.log('\n📋 Seeding Specialties...');
    const specialtyMap = new Map<string, Specialty>();

    for (const data of specialtiesData) {
      let specialty = await specialtyRepo.findOne({ where: { name: data.name } });
      
      if (!specialty) {
        specialty = specialtyRepo.create({
          name: data.name,
          description: data.description,
          displayOrder: data.displayOrder,
          isActive: true,
        });
        await specialtyRepo.save(specialty);
        console.log(`  ✅ Created: ${data.name}`);
      } else {
        console.log(`  ⚠️ Exists: ${data.name}`);
      }
      
      specialtyMap.set(data.name, specialty);

      // Seed SubSpecialties
      for (const subData of data.subSpecialties) {
        const existing = await subSpecialtyRepo.findOne({
          where: { name: subData.name, specialtyId: specialty.id },
        });

        if (!existing) {
          const subSpecialty = subSpecialtyRepo.create({
            name: subData.name,
            description: subData.description,
            specialtyId: specialty.id,
            isActive: true,
          });
          await subSpecialtyRepo.save(subSpecialty);
          console.log(`    ✅ SubSpecialty: ${subData.name}`);
        }
      }
    }

    // ========== SEED DOCTORS ==========
    console.log('\n👨‍⚕️ Seeding Doctors...');
    
    for (const docData of sampleDoctors) {
      // Check if email exists
      const existingAccount = await accountRepo.findOne({
        where: { email: docData.email.toLowerCase() },
      });

      if (existingAccount) {
        console.log(`  ⚠️ Doctor exists: ${docData.email}`);
        continue;
      }

      // Get specialty
      const specialty = specialtyMap.get(docData.specialtyName);
      if (!specialty) {
        console.log(`  ❌ Specialty not found: ${docData.specialtyName}`);
        continue;
      }

      // Get sub-specialties
      const subSpecialties: SubSpecialty[] = [];
      for (const subName of docData.subSpecialtyNames) {
        const sub = await subSpecialtyRepo.findOne({
          where: { name: subName, specialtyId: specialty.id },
        });
        if (sub) subSpecialties.push(sub);
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
        specialtyId: specialty.id,
        subSpecialties: subSpecialties,
      });
      await doctorRepo.save(doctor);

      console.log(`  ✅ Created: ${docData.fullName} (${docData.email})`);
    }

    console.log('\n🎉 Seed completed successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Specialties: ${specialtiesData.length}`);
    console.log(`📁 SubSpecialties: ${specialtiesData.reduce((acc, s) => acc + s.subSpecialties.length, 0)}`);
    console.log(`👨‍⚕️ Doctors: ${sampleDoctors.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

seedSpecialtyData();
