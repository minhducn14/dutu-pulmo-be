import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Account } from '../../../account/entities/account.entity';
import { User } from '../../../user/entities/user.entity';
import { RoleEnum } from '../../../common/enums/role.enum';
import { UserStatusEnum } from '../../../common/enums/user-status.enum';

/**
 * Seed admin account
 * Run: npx ts-node -r tsconfig-paths/register src/modules/core/database/seeds/admin.seed.ts
 */
async function seedAdmin() {
  // Load environment variables
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
    entities: [Account, User],
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await dataSource.initialize();
    console.log('🔗 Database connected');

    const accountRepo = dataSource.getRepository(Account);
    const userRepo = dataSource.getRepository(User);

    // Admin credentials
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@telehealth.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
    const adminFullName = process.env.ADMIN_FULLNAME || 'System Administrator';

    // Check if admin already exists
    const existingAccount = await accountRepo.findOne({
      where: { email: adminEmail.toLowerCase() },
    });

    if (existingAccount) {
      console.log(`⚠️ Admin account already exists: ${adminEmail}`);
      await dataSource.destroy();
      return;
    }

    // Create user first
    const user = userRepo.create({
      fullName: adminFullName,
      status: UserStatusEnum.ACTIVE,
    });
    await userRepo.save(user);
    console.log(`✅ User created: ${user.id}`);

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create account
    const account = accountRepo.create({
      email: adminEmail.toLowerCase(),
      password: hashedPassword,
      roles: [RoleEnum.ADMIN],
      isVerified: true,
      userId: user.id,
    });
    await accountRepo.save(account);
    console.log(`✅ Account created: ${account.id}`);

    console.log('');
    console.log('🎉 Admin seeded successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email: ${adminEmail}`);
    console.log(`🔑 Password: ${adminPassword}`);
    console.log(`👤 Role: ADMIN`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

seedAdmin();
