import postgres from 'postgres';
import { config } from './config';

const sql = postgres(config.databaseUrl);

export default sql;
