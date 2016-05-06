(function () {
    'use strict';

    angular.module('core').factory('s3Storage', s3Storage);

    s3Storage.$inject = ['$q', 'ThumbnailService', '$http', '$timeout'];

    function s3Storage($q, ThumbnailService, $http, $timeout) {
        var SERVER_OPTIMIZE_SUPPORTED = ['image/jpeg', 'image/png'];

        var creds = {
            access_key: 'AKIAIUIQPRSPRAZRA2FA',
            secret_key: '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',
            bucket: 'cdn.cardkit.io'
        };

        function upload(key, fileOrBuffer, contentType) {
            key = _.safeUrl(key);

            var done = $q.defer();

            AWS.config.update({accessKeyId: creds.access_key, secretAccessKey: creds.secret_key});
            AWS.config.region = 'us-east-1';

            var bucket = new AWS.S3({params: {Bucket: creds.bucket}});
            var params = {Key: key, ContentType: contentType || fileOrBuffer.type, Body: fileOrBuffer, ServerSideEncryption: 'AES256', ACL:'public-read'};

            var request = bucket.putObject(params, function (err, data) {
                if (err) {
                    done.reject(err);
                }
                else {
                    var s3Url = resolveUrl(key);
                    console.log('File Uploaded Successfully', s3Url);
                    done.resolve(s3Url);
                }
            });

            request.on('httpUploadProgress', function (progress) {
                done.notify(Math.round(progress.loaded / progress.total * 100));
            });

            return done.promise;
        }

        /**
         * Upload image to S3 bucket, optimize
         * @param key
         * @param fileOrBuffer
         * @param contentType
         * @param containSize
         * @returns {*}
         */
        function uploadOptimized(key, fileOrBuffer, contentType, containSize) {
            key = _.safeUrl(key);

            containSize = containSize || {};

            var done = $q.defer();

            var _mb = 1024*1024;
            // 3MB+ images are optimized additionally on client side to unload server optimization
            var clientSideOptimization = fileOrBuffer.size >= 3 * _mb && /^image/.test(mimeType(fileOrBuffer.name));
            var fakeTimer;

            var optimizationTime = 0.6; // takes usually 60% of total time
            var start = new Date();

            upload(key, fileOrBuffer, contentType).then(function (url) {
                var uploadDurationMs = new Date() - start;
                var timerIncrement = 0.8;

                // fake progress timer for image optimization task (which usually takes optimizationTime = 60% of total time)
                var expectedOptimizationTimeMs = uploadDurationMs / (1-optimizationTime) * optimizationTime;
                var progressStart = (1 - optimizationTime) * 100;
                var timerIntervalMs = Math.round(expectedOptimizationTimeMs / (progressStart / timerIncrement));

                var progress = progressStart;
                fakeTimer = $timeout(function fakeTimerTask() {
                    if (100-progress <= Math.ceil(timerIncrement)) return;
                    done.notify(Math.round(progress += timerIncrement));
                    fakeTimer = $timeout(fakeTimerTask, timerIntervalMs);
                }, timerIntervalMs / 2);

                return optimize(key, containSize.width, containSize.height, clientSideOptimization).catch(function (err) {
                    console.error('Failed to optimize image', err);
                    return url; // original image
                });
            }, null, function (progress) {
                done.notify(Math.round(progress * (1 - optimizationTime)));
            }).then(function (url) {
                done.notify(100);
                done.resolve(url);
            }).catch(function (err) {
                console.error(err);
                done.reject(err);
            }).finally(function () {
                $timeout.cancel(fakeTimer);
            });

            return done.promise;
        }

        function salt() {
            var text = "";
            var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

            for (var i = 0; i < 8; i++) {
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            }

            return text;
        }

        function resolveKey(fileName, client) {
            client = client && client.companyName || client;

            var key = client
                ? _.safeUrl('client/' + client.toLowerCase() + '/') + salt() + '-' + _.safeUrl(fileName)
                : 'app/' + salt() + '-' + _.safeUrl(fileName);

            return key;
        }

        function resolveUrl(key) {
            var url = encodeURI("https://s3.amazonaws.com/" + creds.bucket + "/" + _.safeUrl(key));
            return url;
        }

        function thumbnail(url, thumbType, width, height, quality) {
            return loadImage(url).then(function (img) {
                var thumbSize = resizeContain(img, width, height);
                return extractBufferThumbnail(url, thumbSize, thumbType, quality || 0.8);
            }).catch(function (err) {
                console.log('Unable to generate thumbnail, skipping...', err);
                return $q.reject(err);
            });
        }

        function optimize(key, width, height, clientSide) {
            var url = resolveUrl(key);
            var contentType = mimeType(key);
            var thumbType = contentType;
            var thumbExt;
            var targetKey = key;

            var mime = mimeType(key);
            if (mime == 'image/gif') {
                // don't optimize animated gifs (not supported and can't be equally replaced with jpeg format)
                return $q.reject('gif format is not supported');
            }

            var serverNotSupported = mime && !_.contains(SERVER_OPTIMIZE_SUPPORTED, mime);
            if (serverNotSupported) {
                // convert image to supported jpeg format for server-side image optimization
                clientSide = true;
                thumbType = 'image/jpeg';
                thumbExt = '.jpg';
            }

            // client-side optimization
            var prepare = false;
            if ((clientSide || width || height) && /^image/.test(contentType)) {
                width = Math.min(width || Infinity, 2000); // max-width: 2000
                height = Math.min(height || Infinity, 2000); // max-height: 2000

                targetKey = targetKey.replace(/(\..+)?$/i, '-2' + (thumbExt || '$1')); // add -2 suffix and change extension if needed
                prepare = thumbnail(url, thumbType, width, height, 0.9).then(function (imageBuffer) {
                    return upload(targetKey, imageBuffer, thumbType);
                }).then(function (url) {
                    console.log('Resized image saved to', url);
                    return url;
                });
            }

            // server-side optimization
            var opts = { key: targetKey };
            return $q.when(prepare || url).then(function (url) {
                if (!prepare) {
                    opts.width = width;
                    opts.height = height;
                }
                return $http.post('/optimize/image/s3', opts).catch(function (response) {
                    if (prepare) return url; // optimized on client side
                    return $q.reject(response);
                });
            }).then(function(response) {
                var url = response.data && response.data.url;
                console.log('Image optimized and saved to', url, 'with params', opts);
                return url;
            });
        }

        function mimeType(filePath) {
            var ext = (filePath || '').match(/\.([^.]+)$/);
            switch (ext && ext[1]) {
                case 'jpg':
                case 'jpeg':
                    return 'image/jpeg';
                case 'png':
                    return 'image/png';
                case 'bmp':
                    return 'image/bmp';
                case 'gif':
                    return 'image/gif';
                case 'ico':
                    return 'image/x-icon';
                case 'tif':
                case 'tiff':
                    return 'image/tiff';
            }
        }

        //
        // PRIVATE FUNCTIONS
        //

        function resizeContain(img, maxWidth, maxHeight) {
            maxWidth = maxWidth || Infinity;
            maxHeight = maxHeight || Infinity;

            var width = img.naturalWidth;
            var height = img.naturalHeight;

            var scale = Math.min(maxWidth / width, maxHeight / height, 1);
            var newSize = {
                width: width * scale,
                height: height * scale
            };

            return newSize;
        }

        function extractBufferThumbnail(imageUrl, size, type, imageQuality) {
            return ThumbnailService.generate(imageUrl, {
                width: size.width,
                height: size.height,
                returnType: 'blob',
                type: type || 'image/jpeg',
                encoderOptions: imageQuality
            }).then(function (blob) {
                return blobUtil.blobToArrayBuffer(blob);
            });
        }

        function loadImage(url) {
            var def = $q.defer();

            var img = new Image();
            img.onload = def.resolve.bind(def, img);
            img.onerror = def.reject.bind(def, img);
            img.src = url;

            return def.promise;
        }

        return {
            upload: upload,
            uploadOptimized: uploadOptimized,
            thumbnail: thumbnail,
            optimize: optimize,
            mimeType: mimeType,
            salt: salt,
            resolveKey: resolveKey,
            resolveUrl: resolveUrl
        };
    }
})();
