import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import databaseConfig, {
  toTypeOrmOptions,
} from '@/config/database.config';

const getOptions = async () => {
  const cfg = await databaseConfig();
  return toTypeOrmOptions(cfg);
};

const getAppDataSource = async () => {
  const options = await getOptions();
  return new DataSource(options);
};

const AppDataSourcePromise = getAppDataSource();
export default AppDataSourcePromise;
