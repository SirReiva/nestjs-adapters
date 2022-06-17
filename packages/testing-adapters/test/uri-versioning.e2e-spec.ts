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
import getPort from 'get-port';

const Adapters = [KoaAdapter, PolkaAdapter, RestanaAdapter];

const url = 'http://localhost';

Adapters.forEach((Adapter) => {
    let port: number;
    describe(`VERSIONING ${Adapter.name} (e2e)`, () => {
        let app: INestApplication;

        beforeAll(async () => {
            port = await getPort();
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [AppModule],
                },
            ).compile();

            app = moduleFixture.createNestApplication(new Adapter());
            app.setGlobalPrefix('api');
            app.enableVersioning({
                type: VersioningType.URI,
            });
            app.useGlobalPipes(new ValidationPipe());
            await app.init();
            await app.listen(port);
        });

        afterAll(async () => {
            app && (await app.close());
            app = null;
        });

        it('/api/v1/resources (GET)', (done) => {
            request(`${url}:${port}`)
                .get('/api/v1/resources')
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).toEqual('Hello World!V1');
                    return done();
                });
        });

        it('/api/v2/resources (GET)', (done) => {
            request(`${url}:${port}`)
                .get('/api/v2/resources')
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).toEqual('Hello World!V2');
                    return done();
                });
        });
    });
});
