var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var jshint = require('gulp-jshint');
var minifyCSS = require('gulp-minify-css');
var ignore = require('gulp-ignore');
var rename = require('gulp-rename');
var del = require('del');
var mainBowerFiles = require('main-bower-files');

var paths = {
	scripts: 'public/*.js',
	css: 'public/*.css'
};

gulp.task('clean', function(cb) {
	del(['public/dist'], cb);
});

gulp.task('test', function() {
	return gulp.src(paths.scripts)
		.pipe(jshint())
		.pipe(jshint.reporter('default'));
});

gulp.task('compileJS', ['clean'], function() {
	gulp.src(mainBowerFiles(), { base: 'bower_components' })
		.pipe(ignore.include('*.js'))
		.pipe(sourcemaps.init())
			.pipe(concat('components.min.js'))
			.pipe(uglify())
		.pipe(sourcemaps.write('../maps'))
		.pipe(gulp.dest('public/dist/js'));

	gulp.src(paths.scripts)
		.pipe(sourcemaps.init())
			.pipe(concat('client.min.js'))
			.pipe(uglify())
		.pipe(sourcemaps.write('../maps'))
		.pipe(gulp.dest('public/dist/js'));
});

gulp.task('compileCSS', ['clean'], function () {
	gulp.src(mainBowerFiles(), { base: 'bower_components' })
		.pipe(ignore.include('*.css'))
		.pipe(concat('components.min.css'))
		.pipe(minifyCSS())
		.pipe(gulp.dest('public/dist/styles'));

	gulp.src(paths.css)
		.pipe(concat('style.min.css'))
		.pipe(minifyCSS())
		.pipe(gulp.dest('public/dist/styles'));
});

gulp.task('writeFonts', ['clean'], function () {
	gulp.src('bower_components/**/*.{ttf,woff,eot,svg}', { base: 'bower_components' })
		.pipe(rename({ dirname: '' }))
		.pipe(gulp.dest('public/dist/styles'))
});

gulp.task('no-watch', ['test', 'compileJS', 'compileCSS', 'writeFonts']);

gulp.task('watch', function() {
  gulp.watch(paths.scripts, ['no-watch']);
  gulp.watch(paths.css, ['no-watch']);
});

gulp.task('default', ['no-watch', 'watch']);
