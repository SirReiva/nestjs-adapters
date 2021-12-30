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
                type: VersioningType.URI,
            });
            app.useGlobalPipes(new ValidationPipe());
            await app.init();
        });

        afterEach(async () => {
            await app.close();
        });

        it('/api/todos (GET)', (done) => {
            request(app.getHttpServer())
                .get('/api/todos')
                .expect(200)
                .expect('Content-Type', /json/)
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(res.body).toHaveLength(6);
                    return done();
                });
        });

        it('/api/todos/0 (GET)', (done) => {
            request(app.getHttpServer())
                .get('/api/todos/0')
                .expect(200)
                .expect('Content-Type', /json/)
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(res.body.id).toEqual('0');
                    return done();
                });
        });

        it('/api/todos (POST)', (done) => {
            request(app.getHttpServer())
                .post('/api/todos')
                .send({
                    title: 'task1',
                    done: false,
                })
                .expect(201)
                .expect('Content-Type', /json/)
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(res.body.title).toEqual('task1');
                    expect(res.body.done).toEqual(false);
                    expect(res.body).toHaveProperty('id');
                    return done();
                });
        });

        it('/api/todos (DELETE)', (done) => {
            request(app.getHttpServer())
                .delete('/api/todos/0')
                .expect(204)
                .end(function (err, res) {
                    if (err) return done(err);
                    expect(res.body).toEqual({});
                    return done();
                });
        });

        it('/api/todos/nofound (DELETE)', (done) => {
            request(app.getHttpServer())
                .delete('/api/todos/sdfgfdgsdfg')
                .expect(404)
                .end(done);
        });

        it('/api/todos/nofound (GET)', (done) => {
            request(app.getHttpServer())
                .get('/api/todos/nofound')
                .expect(404)
                .end(done);
        });

        it('/api/v1/resources (GET)', (done) => {
            request(app.getHttpServer())
                .get('/api/v1/resources')
                .expect(200)
                .end((err, res) => {
                    if (err) return done(err);
                    expect(res.text).toEqual('Hello World!V1');
                    return done();
                });
        });

        it('/api/v2/resources (GET)', (done) => {
            request(app.getHttpServer())
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
