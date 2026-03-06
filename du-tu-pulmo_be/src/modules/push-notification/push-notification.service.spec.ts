import { Test, TestingModule } from '@nestjs/testing';
import { PushNotificationService } from './push-notification.service';
import { ConfigService } from '@nestjs/config';
import { UserService } from '@/modules/user/user.service';

describe('PushNotificationService', () => {
  let service: PushNotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'FIREBASE_PROJECT_ID') return 'test-project';
              if (key === 'FIREBASE_PRIVATE_KEY') return 'test-key';
              if (key === 'FIREBASE_CLIENT_EMAIL') return 'test@firebase.com';
              return null;
            }),
          },
        },
        {
          provide: UserService,
          useValue: {
            findOne: jest.fn(),
            removeFcmToken: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PushNotificationService>(PushNotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
