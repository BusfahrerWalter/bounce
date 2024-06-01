import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ mode }) => {
	const isProd = mode === 'prod';
	return {
		base: '',
		root: '.',
		server: {
			port: 5000,
			strictPort: true
		},
		build: {
			outDir: 'dist',
			sourcemap: !isProd,
			minify: isProd,
			rollupOptions: {
				input: 'index.html',
				output: {
					assetFileNames: '[name][extname]',
					chunkFileNames: '[name].js',
					entryFileNames: '[name].js'
				}
			}
		},
		plugins: [
			viteStaticCopy({
				targets: [{
					src: './src/assets/*',
					dest: 'src/assets'
				}]
			})
		]
	};
});
