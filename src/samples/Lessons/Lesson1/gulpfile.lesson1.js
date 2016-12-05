module.exports = (gulp, runSequence) => {
  gulp.task('run', (cb) => {
    runSequence('deploy', 'listen', cb);
  });
};
