import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { ChatMessage } from '../../chatmessage/entities/chatmessage.entity';

@Entity()
export class ChatRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  user1: User;

  @ManyToOne(() => User)
  user2: User;

  @OneToMany(() => ChatMessage, (message) => message.chatroom)
  messages: ChatMessage[];

  @CreateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
