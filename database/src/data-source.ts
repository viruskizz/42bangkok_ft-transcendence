import "reflect-metadata"
import { DataSource } from "typeorm"
import * as dotenv from "dotenv";
import { User } from "@entities/user.entity";
import { Friendship } from "@backend/typeorm/friendship.entity";
import { UserSession } from "@backend/typeorm/user-session.entity";

dotenv.config({ path: '../.env' })

export const AppDataSource = new DataSource({
    type: "postgres",
    host: "localhost",
    port: +process.env.DB_PORT,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: true,
    logging: false,
    entities: [User, Friendship, UserSession],
    migrations: [],
    subscribers: [],
})
