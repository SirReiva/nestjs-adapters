import { KoaAdapter } from '@nestjs-adapters/koa';
import { RestanaAdapter } from '@nestjs-adapters/restana';
import {
    INestApplication,
    ValidationPipe,
    VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import getPort from 'get-port';
import request from 'supertest';
import { AppModule } from './../src/app.module';

const Adapters = [KoaAdapter, /*PolkaAdapter,*/ RestanaAdapter];

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
                type: VersioningType.HEADER,
                header: 'version',
            });
            app.useGlobalPipes(new ValidationPipe());
            await app.init();
            await app.listen(port);
        });

        afterAll(async () => {
            app && (await app.close());
            app = null;
        });

        it('/api/resources (GET)', (done) => {
            request(`${url}:${port}`)
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
            request(`${url}:${port}`)
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
