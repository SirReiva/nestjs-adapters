import {
	Abstract,
	DynamicModule,
	Module,
	Provider,
	Type,
} from '@nestjs/common';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { MULTER_MODULE_OPTIONS } from './files.constants';
import {
	MulterModuleAsyncOptions,
	MulterModuleOptions,
	MulterOptionsFactory,
} from './interfaces/files-upload-module.interface';
import { MULTER_MODULE_ID } from './multer.constants';

@Module({})
export class MulterModule {
	static register(options: MulterModuleOptions = {}): DynamicModule {
		return {
			module: MulterModule,
			providers: [
				{ provide: MULTER_MODULE_OPTIONS, useValue: options },
				{
					provide: MULTER_MODULE_ID,
					useValue: randomStringGenerator(),
				},
			],
			exports: [MULTER_MODULE_OPTIONS],
		};
	}

	static registerAsync(options: MulterModuleAsyncOptions): DynamicModule {
		return {
			module: MulterModule,
			imports: options.imports,
			providers: [
				...this.createAsyncProviders(options),
				{
					provide: MULTER_MODULE_ID,
					useValue: randomStringGenerator(),
				},
			],
			exports: [MULTER_MODULE_OPTIONS],
		};
	}

	private static createAsyncProviders(
		options: MulterModuleAsyncOptions
	): Provider[] {
		if (options.useExisting || options.useFactory) {
			return [this.createAsyncOptionsProvider(options)];
		}
		if (options.useClass)
			return [
				this.createAsyncOptionsProvider(options),
				{
					provide: options.useClass,
					useClass: options.useClass,
				},
			];
		throw new Error('Invalid MulterModuleAsyncOptions');
	}

	private static createAsyncOptionsProvider(
		options: MulterModuleAsyncOptions
	): Provider {
		if (options.useFactory) {
			return {
				provide: MULTER_MODULE_OPTIONS,
				useFactory: options.useFactory,
				inject: options.inject || [],
			};
		}

		const injections: (
			| string
			| symbol
			| Function
			| Type<any>
			| Abstract<any>
		)[] = [];
		if (options.useClass) injections.push(options.useClass);
		if (options.useExisting) injections.push(options.useExisting);

		return {
			provide: MULTER_MODULE_OPTIONS,
			useFactory: async (optionsFactory: MulterOptionsFactory) =>
				optionsFactory.createMulterOptions(),
			inject: injections,
		};
	}
}
