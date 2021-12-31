import { Test, TestingModule } from '@nestjs/testing';
import {
    INestApplication,
    ValidationPipe,
    VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { KoaAdapter } from '@nestjs-adapters/koa';
import { AppModule } from './../src/app.module';
import { PolkaAdapter } from '@nestjs-adapters/polka';
import { RestanaAdapter } from '@nestjs-adapters/restana';

const Adapters = [KoaAdapter, PolkaAdapter, RestanaAdapter];

Adapters.forEach((Adapter) => {
    describe(`VERSIONING ${Adapter.name} (e2e)`, () => {
        let app: INestApplication;

        beforeEach(async () => {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [AppModule],
                },
            ).compile();

            app = moduleFixture.createNestApplication(new Adapter());
            app.setGlobalPrefix('api');
            app.enableVersioning({
                type: VersioningType.HEADER,
                header: 'version'
            });
            app.useGlobalPipes(new ValidationPipe());
            await app.init();
        });

        afterEach(async () => {
            await app.close();
        });

        it('/api/resources (GET)', (done) => {
            request(app.getHttpServer())
                .get('/api/resources')
                .set('version', '1')
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).toEqual('Hello World!V1');
                    return done();
                });
        });

        it('/api/resources (GET)', (done) => {
            request(app.getHttpServer())
                .get('/api/resources')
                .set('version', '2')
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).toEqual('Hello World!V2');
                    return done();
                });
        });
    });
});
