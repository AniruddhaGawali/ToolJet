import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { authHeaderForUser, clearDB, createUser, createNestAppInstance } from '../test.helper';

describe('library apps controller', () => {
  let app: INestApplication;

  beforeEach(async () => {
    await clearDB();
  });

  beforeAll(async () => {
    app = await createNestAppInstance();
  });

  describe('POST /api/library_apps', () => {
    it('should be able to create app if user has app create permission or has instance user type', async () => {
      const adminUserData = await createUser(app, {
        email: 'admin@tooljet.io',
        groups: ['all_users', 'admin'],
      });

      const superAdminUserData = await createUser(app, {
        email: 'superadmin@tooljet.io',
        groups: ['all_users', 'admin'],
        userType: 'instance',
      });

      const organization = adminUserData.organization;
      const nonAdminUserData = await createUser(app, {
        email: 'developer@tooljet.io',
        groups: ['all_users'],
        organization,
      });

      let response = await request(app.getHttpServer())
        .post('/api/library_apps')
        .send({ identifier: 'github-contributors' })
        .set('Authorization', authHeaderForUser(nonAdminUserData.user));

      expect(response.statusCode).toBe(403);

      response = await request(app.getHttpServer())
        .post('/api/library_apps')
        .send({ identifier: 'github-contributors' })
        .set('Authorization', authHeaderForUser(adminUserData.user));

      expect(response.statusCode).toBe(201);
      expect(response.body.name).toBe('GitHub Contributor Leaderboard');

      response = await request(app.getHttpServer())
        .post('/api/library_apps')
        .send({ identifier: 'github-contributors' })
        .set('Authorization', authHeaderForUser(superAdminUserData.user, adminUserData.organization.id));

      expect(response.statusCode).toBe(201);
      expect(response.body.name).toBe('GitHub Contributor Leaderboard');
    });

    it('should return error if template identifier is not found', async () => {
      const adminUserData = await createUser(app, {
        email: 'admin@tooljet.io',
        groups: ['all_users', 'admin'],
      });

      const response = await request(app.getHttpServer())
        .post('/api/library_apps')
        .send({ identifier: 'non-existent-template' })
        .set('Authorization', authHeaderForUser(adminUserData.user));

      const { timestamp, ...restBody } = response.body;

      expect(timestamp).toBeDefined();
      expect(restBody).toEqual({
        message: 'App definition not found',
        path: '/api/library_apps',
        statusCode: 400,
      });
    });
  });

  describe('GET /api/library_apps', () => {
    it('should be get app manifests', async () => {
      const adminUserData = await createUser(app, {
        email: 'admin@tooljet.io',
        groups: ['all_users', 'admin'],
      });

      const superAdminUserData = await createUser(app, {
        email: 'superadmin@tooljet.io',
        groups: ['all_users', 'admin'],
        userType: 'instance',
      });

      let response = await request(app.getHttpServer())
        .get('/api/library_apps')
        .set('Authorization', authHeaderForUser(adminUserData.user));

      expect(response.statusCode).toBe(200);

      let templateAppIds = response.body['template_app_manifests'].map((manifest) => manifest.id);

      expect(new Set(templateAppIds)).toContain('github-contributors');
      expect(new Set(templateAppIds)).toContain('customer-dashboard');

      response = await request(app.getHttpServer())
        .get('/api/library_apps')
        .set('Authorization', authHeaderForUser(superAdminUserData.user, adminUserData.organization.id));

      expect(response.statusCode).toBe(200);

      templateAppIds = response.body['template_app_manifests'].map((manifest) => manifest.id);

      expect(new Set(templateAppIds)).toContain('github-contributors');
      expect(new Set(templateAppIds)).toContain('customer-dashboard');
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
