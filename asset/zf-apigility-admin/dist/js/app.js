(function() {'use strict';

/**
 * Declare and configure modules
 */
angular.module(
    'ag-admin', 
    [
        'ngRoute',
        'ngSanitize',
        'ngTagsInput',
        'angular-flash.service',
        'angular-flash.flash-alert-directive',
        'ui.sortable',
        'ui.select2',
        'toggle-switch'
    ]
).config([
    '$routeProvider', '$provide', 
    function($routeProvider, $provide) {
        // setup the API Base Path (this should come from initial ui load/php)
        $provide.value('apiBasePath', angular.element('body').data('api-base-path') || '/admin/api');

        $routeProvider.when('/dashboard', {
            templateUrl: 'zf-apigility-admin/dist/html/index.html',
            controller: 'DashboardController'
        });
        $routeProvider.when('/global/content-negotiation', {
            templateUrl: 'zf-apigility-admin/dist/html/global/content-negotiation/index.html',
            controller: 'ContentNegotiationController',
            resolve: {
                selectors: ['ContentNegotiationResource', function (ContentNegotiationResource) {
                    return ContentNegotiationResource.getList();
                }]
            }
        });
        $routeProvider.when('/global/db-adapters', {
            templateUrl: 'zf-apigility-admin/dist/html/global/db-adapters/index.html',
            controller: 'DbAdapterController',
            resolve: {
                dbAdapters: ['DbAdapterResource', function (DbAdapterResource) {
                    return DbAdapterResource.getList();
                }]
            }
        });
        $routeProvider.when('/global/authentication', {
            templateUrl: 'zf-apigility-admin/dist/html/global/authentication/index.html',
            controller: 'AuthenticationController'
        });
        $routeProvider.when('/api/:apiName/:version/overview', {
            templateUrl: 'zf-apigility-admin/dist/html/api/overview.html',
            controller: 'ApiOverviewController',
            resolve: {
                api: ['$route', 'ApiRepository', function ($route, ApiRepository) {
                    return ApiRepository.getApi($route.current.params.apiName, $route.current.params.version);
                }]
            }
        });
        $routeProvider.when('/api/:apiName/:version/authorization', {
            templateUrl: 'zf-apigility-admin/dist/html/api/authorization.html',
            controller: 'ApiAuthorizationController',
            resolve: {
                api: ['$route', 'ApiRepository', function ($route, ApiRepository) {
                    return ApiRepository.getApi($route.current.params.apiName, $route.current.params.version);
                }],
                apiAuthorizations: ['$route', 'ApiAuthorizationRepository', function ($route, ApiAuthorizationRepository) {
                    return ApiAuthorizationRepository.getApiAuthorization($route.current.params.apiName, $route.current.params.version);
                }],
                authentication: ['AuthenticationRepository', function (AuthenticationRepository) {
                    return AuthenticationRepository.hasAuthentication();
                }]
            }
        });
        $routeProvider.when('/api/:apiName/:version/rest-services', {
            templateUrl: 'zf-apigility-admin/dist/html/api/rest-services/index.html',
            controller: 'ApiRestServicesController',
            resolve: {
                dbAdapters: ['DbAdapterResource', function (DbAdapterResource) {
                    return DbAdapterResource.getList();
                }],
                api: ['$route', 'ApiRepository', function ($route, ApiRepository) {
                    return ApiRepository.getApi($route.current.params.apiName, $route.current.params.version);
                }],
                filters: ['FiltersServicesRepository', function (FiltersServicesRepository) {
                    return FiltersServicesRepository.getList();
                }],
                validators: ['ValidatorsServicesRepository', function (ValidatorsServicesRepository) {
                    return ValidatorsServicesRepository.getList();
                }],
                hydrators: ['HydratorServicesRepository', function (HydratorServicesRepository) {
                    return HydratorServicesRepository.getList();
                }],
                selectors: ['ContentNegotiationResource', function (ContentNegotiationResource) {
                    return ContentNegotiationResource.getList().then(function (selectors) {
                        var selectorNames = [];
                        angular.forEach(selectors, function (selector) {
                            selectorNames.push(selector.content_name);
                        });
                        return selectorNames;
                    });
                }]
            }
        });
        $routeProvider.when('/api/:apiName/:version/rpc-services', {
            templateUrl: 'zf-apigility-admin/dist/html/api/rpc-services/index.html',
            controller: 'ApiRpcServicesController',
            resolve: {
                api: ['$route', 'ApiRepository', function ($route, ApiRepository) {
                    return ApiRepository.getApi($route.current.params.apiName, $route.current.params.version);
                }],
                filters: ['FiltersServicesRepository', function (FiltersServicesRepository) {
                    return FiltersServicesRepository.getList();
                }],
                validators: ['ValidatorsServicesRepository', function (ValidatorsServicesRepository) {
                    return ValidatorsServicesRepository.getList();
                }],
                selectors: ['ContentNegotiationResource', function (ContentNegotiationResource) {
                    return ContentNegotiationResource.getList().then(function (selectors) {
                        var selectorNames = [];
                        angular.forEach(selectors, function (selector) {
                            selectorNames.push(selector.content_name);
                        });
                        return selectorNames;
                    });
                }]
            }
        });
        $routeProvider.otherwise({redirectTo: '/dashboard'});
    }
]);

})();

(function(_) {'use strict';

angular.module('ag-admin').controller(
    'ApiAuthorizationController',
    ['$http', '$rootScope', '$scope', '$routeParams', 'flash', 'api', 'apiAuthorizations', 'authentication', 'ApiAuthorizationRepository', function ($http, $rootScope, $scope, $routeParams, flash, api, apiAuthorizations, authentication, ApiAuthorizationRepository) {
        $scope.api = api;
        $scope.apiAuthorizations = apiAuthorizations;
        $scope.authentication = authentication;

        var version = $routeParams.version.match(/\d/g)[0] || 1;
        $scope.editable = (version == api.versions[api.versions.length - 1]);

        var serviceMethodMap = (function() {
            var services = {};
            angular.forEach(api.restServices, function(service) {
                var entityName = service.controller_service_name + '::__resource__';
                var collectionName = service.controller_service_name + '::__collection__';
                var entityMethods = {
                    GET: false,
                    POST: false,
                    PUT: false,
                    PATCH: false,
                    DELETE: false,
                };
                var collectionMethods = {
                    GET: false,
                    POST: false,
                    PUT: false,
                    PATCH: false,
                    DELETE: false,
                };
                angular.forEach(service.resource_http_methods, function(method) {
                    entityMethods[method] = true;
                });
                angular.forEach(service.collection_http_methods, function(method) {
                    collectionMethods[method] = true;
                });
                services[entityName] = entityMethods;
                services[collectionName] = collectionMethods;
            });

            angular.forEach(api.rpcServices, function(service) {
                var serviceName = service.controller_service_name;
                var serviceMethods = {
                    GET: false,
                    POST: false,
                    PUT: false,
                    PATCH: false,
                    DELETE: false,
                };
                angular.forEach(service.http_methods, function(method) {
                    serviceMethods[method] = true;
                });
                services[serviceName] = serviceMethods;
            });

            return services;
        })();

        $scope.isEditable = function(serviceName, method) {
            if (!$scope.editable) {
                return false;
            }

            if (!serviceMethodMap.hasOwnProperty(serviceName)) {
                var parts = serviceName.split('::');
                var test  = parts[0];
                if (!serviceMethodMap.hasOwnProperty(test)) {
                    return false;
                }
                serviceName = test;
            }

            return serviceMethodMap[serviceName][method];
        };

        $scope.saveAuthorization = function () {
            flash.success = 'Authorization settings saved';
            ApiAuthorizationRepository.saveApiAuthorizations($routeParams.apiName, $scope.apiAuthorizations);
        };

        $scope.updateColumn = function ($event, column) {
            angular.forEach($scope.apiAuthorizations, function (item, name) {
                if ($scope.isEditable(name, column)) {
                    $scope.apiAuthorizations[name][column] = $event.target.checked;
                }
            });
        };

        $scope.updateRow = function ($event, name) {
            _.forEach(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], function (method) {
                if ($scope.isEditable(name, method)) {
                    $scope.apiAuthorizations[name][method] = $event.target.checked;
                }
            });
        };

        $scope.showTopSaveButton = function () {
            return (Object.keys(apiAuthorizations).length > 10);
        };
    }]
);

})(_);

(function() {'use strict';

angular.module('ag-admin').controller(
    'ApiCreateController',
    ['$rootScope', '$scope', '$location', '$timeout', 'flash', 'ApiRepository', function($rootScope, $scope, $location, $timeout, flash, ApiRepository) {

        $scope.showNewApiForm = false;

        $scope.createNewApi = function ($event) {
            var form = angular.element($event.target);
            form.find('input').attr('disabled', true);
            form.find('button').attr('disabled', true);

            ApiRepository.createNewApi($scope.apiName).then(function (newApi) {
                // reset form, repopulate, redirect to new
                $scope.dismissModal();
                $scope.resetForm();
                $rootScope.$emit('refreshApiList');

                flash.success = 'New API Created';
                $timeout(function () {
                    $location.path('/api/' + newApi.name + '/v1/overview');
                }, 500);
            });
        };

        $scope.resetForm = function () {
            $scope.showNewApiForm = false;
            $scope.apiName = '';
        };
    }]
);
})();

(function(_) {'use strict';

angular.module('ag-admin').controller(
    'ApiDocumentationController',
    ['$rootScope', '$scope', '$timeout', '$routeParams', 'flash', 'ApiRepository', 'ApiAuthorizationRepository',
    function ($rootScope, $scope, $timeout, $routeParams, flash, ApiRepository, ApiAuthorizationRepository) {

        var moduleName = $routeParams.apiName;
        var version    = $routeParams.version;
        
        $scope.service = (typeof $scope.$parent.restService != 'undefined') ? $scope.$parent.restService : $scope.$parent.rpcService;
        $scope.authorizations = {};

        // for REST
        if (typeof $scope.$parent.restService != 'undefined') {
            if (typeof $scope.service.documentation == 'undefined') {
                $scope.service.documentation = {};
            }
            if (typeof $scope.service.documentation.collection == 'undefined') {
                $scope.service.documentation.collection = {};
            }
            _.forEach($scope.service.collection_http_methods, function (allowed_method) {
                if (typeof $scope.service.documentation.collection[allowed_method] == 'undefined') {
                    $scope.service.documentation.collection[allowed_method] = {description: null, request: null, response: null};
                }
            });
            if (typeof $scope.service.documentation.entity == 'undefined') {
                $scope.service.documentation.entity = {};
            }
            _.forEach($scope.service.resource_http_methods, function (allowed_method) {
                if (typeof $scope.service.documentation.entity[allowed_method] == 'undefined') {
                    $scope.service.documentation.entity[allowed_method] = {description: null, request: null, response: null};
                }
            });

        // for RPC
        } else {
            if (typeof $scope.service.documentation == 'undefined') {
                $scope.service.documentation = {};
            }
            _.forEach($scope.service.http_methods, function (allowed_method) {
                if (typeof $scope.service.documentation[allowed_method] == 'undefined') {
                    $scope.service.documentation[allowed_method] = {description: null, request: null, response: null};
                }
            });
        }

        ApiAuthorizationRepository.getServiceAuthorizations($scope.service, moduleName, version).then(function (authorizations) {
            $scope.authorizations = authorizations;
        });

        $scope.requiresAuthorization = function (method, type) {
            var authorizations = $scope.authorizations;
            if (type == 'entity' || type == 'collection') {
                return authorizations[type][method];
            }
            return authorizations[method];
        };

        var hasHalMediaType = function (mediatypes) {
            if (typeof mediatypes !== 'object' || !Array.isArray(mediatypes)) {
                return false;
            }

            if (mediatypes.lastIndexOf('application/hal+json') === -1) {
                return false;
            }

            return true;
        };

        var tab = function (num) {
            return new Array(num * 4).join(' ');
        };

        var createLink = function (rel, routeMatch, indent, append, type) {
            if (type == 'collection') {
                routeMatch = routeMatch.replace(/\[[a-zA-Z0-9_\/:\-]+\]$/, '');
            }
            if (append) {
                routeMatch += append;
            }
            return tab(indent) + "\"" + rel + "\": {\n" + tab(indent + 1) + "\"href\": \"" + routeMatch + "\"\n" + tab(indent) + "}";
        };

        var createLinks = function (links, indent) {
            return tab(indent) + "\"_links\": {\n" + links.join(",\n") + "\n" + tab(indent) + "}\n";
        };

        var createCollection = function (collectionName, routeMatch, params) {
            var entityLinks = [ createLink('self', routeMatch, 5) ];
            var collection = tab(1) + "\"_embedded\": {\n" + tab(2) + "\"" + collectionName + "\": [\n" + tab(3) + "{\n";
            collection += createLinks(entityLinks, 4);
            collection += params.join(",\n") + "\n" + tab(3) + "}\n" + tab(2) + "]\n" + tab(1) + "}";
            return collection;
        };

        $scope.generate = function(model, method, direction, restPart) {
            var doctext   = '';
            var docparams = [];
            var isHal     = false;
            var links     = [];

            if (direction == 'response' && $scope.service.accept_whitelist) {
                isHal = hasHalMediaType($scope.service.accept_whitelist);
            }

            _.forEach($scope.service.input_filter, function (item) {
                docparams.push(tab(1) + '"' + item.name + '": "' + (item.description || '') + '"');
            });
            

            if (isHal && (restPart != 'collection' || method == 'POST')) {
                links.push(createLink('self', $scope.service.route_match, 2));
                doctext = "{\n" + createLinks(links, 1) + docparams.join(",\n") + "\n}";
            } else if (isHal && restPart == 'collection') {
                var collectionName = $scope.service.collection_name ? $scope.service.collection_name : 'items';
                _.forEach(docparams, function (param, key) {
                    docparams[key] = tab(3) + param;
                });
                links.push(createLink('self', $scope.service.route_match, 2, false, 'collection'));
                links.push(createLink('first', $scope.service.route_match, 2, '?page={page}', 'collection'));
                links.push(createLink('prev', $scope.service.route_match, 2, '?page={page}', 'collection'));
                links.push(createLink('next', $scope.service.route_match, 2, '?page={page}', 'collection'));
                links.push(createLink('last', $scope.service.route_match, 2, '?page={page}', 'collection'));
                doctext = "{\n" + createLinks(links, 1) + createCollection(collectionName, $scope.service.route_match, docparams) + "\n}";
            } else {
                doctext = "{\n" + docparams.join(",\n") + "\n}";
            }

            if (!model[direction]) {
                model[direction] = doctext;
            } else {
                model[direction] += "\n" + doctext;
            }

        };

        $scope.save = function() {
            ApiRepository.saveDocumentation($scope.service);
            $scope.$parent.flash.success = 'Documentation saved.';
        };

    }]
);

})(_);

(function() {'use strict';

angular.module('ag-admin').controller(
    'ApiListController',
    ['$rootScope', '$scope', 'ApiRepository', function($rootScope, $scope, ApiRepository) {

        $scope.apis = [];

        $scope.refreshApiList = function () {
            ApiRepository.getList(true).then(function (apis) { $scope.apis = apis; });
        };

        $rootScope.$on('refreshApiList', function () { $scope.refreshApiList(); });
    }]
);
})();

(function() {'use strict';

angular.module('ag-admin').controller('ApiOverviewController', ['$http', '$rootScope', '$scope', 'flash', 'api', 'ApiRepository', function ($http, $rootScope, $scope, flash, api, ApiRepository) {
    $scope.api = api;
    $scope.defaultApiVersion = api.default_version;
    $scope.setDefaultApiVersion = function () {
        flash.info = 'Setting the default API version to ' + $scope.defaultApiVersion;
        ApiRepository.setDefaultApiVersion($scope.api.name, $scope.defaultApiVersion).then(function (data) {
            flash.success = 'Default API version updated';
            $scope.defaultApiVersion = data.version;
        });
    };
}]);

})();

(function(_) {'use strict';

angular.module('ag-admin').controller(
  'ApiRestServicesController', 
  ['$http', '$rootScope', '$scope', '$timeout', '$sce', 'flash', 'filters', 'hydrators', 'validators', 'selectors', 'ApiRepository', 'api', 'dbAdapters', 'toggleSelection', 
  function ($http, $rootScope, $scope, $timeout, $sce, flash, filters, hydrators, validators, selectors, ApiRepository, api, dbAdapters, toggleSelection) {

    $scope.ApiRepository = ApiRepository; // used in child controller (input filters)
    $scope.flash = flash;

    $scope.api = api;

    $scope.dbAdapters = dbAdapters;

    $scope.filterOptions = filters;

    $scope.hydrators = hydrators;

    $scope.validatorOptions = validators;

    $scope.selectors = selectors;

    $scope.sourceCode = [];

    $scope.deleteRestService = false;

    $scope.toggleSelection = toggleSelection;

    $scope.resetForm = function () {
        $scope.showNewRestServiceForm = false;
        $scope.newService.restServiceName = '';
        $scope.newService.dbAdapterName = '';
        $scope.newService.dbTableName = '';
    };

    $scope.isLatestVersion = function () {
        return $scope.ApiRepository.isLatestVersion($scope.api);
    };

    $scope.isDbConnected = function (restService) {
        if (typeof restService !== 'object' || typeof restService === 'undefined') {
            return false;
        }
        if (restService.hasOwnProperty('adapter_name') || restService.hasOwnProperty('table_name') || restService.hasOwnProperty('table_service')) {
            return true;
        }
        return false;
    };

    $scope.newService = {
        restServiceName: '',
        dbAdapterName: '',
        dbTableName: ''
    };

    $scope.newService.createNewRestService = function () {
        ApiRepository.createNewRestService($scope.api.name, $scope.newService.restServiceName).then(function (restResource) {
            flash.success = 'New REST Service created';
            $timeout(function () {
                ApiRepository.getApi($scope.api.name, $scope.api.version, true).then(function (api) {
                    $scope.api = api;
                    $scope.currentVersion = api.currentVersion;
                });
            }, 500);
            $scope.showNewRestServiceForm = false;
            $scope.newService.restServiceName = '';
        }, function (response) {
        });
    };

    $scope.newService.createNewDbConnectedService = function () {
        ApiRepository.createNewDbConnectedService($scope.api.name, $scope.newService.dbAdapterName, $scope.newService.dbTableName).then(function (restResource) {
            flash.success = 'New DB Connected Service created';
            $timeout(function () {
                ApiRepository.getApi($scope.api.name, $scope.api.version, true).then(function (api) {
                    $scope.api = api;
                });
            }, 500);
            $scope.showNewRestServiceForm = false;
            $scope.newService.dbAdapterName = '';
            $scope.newService.dbTableName = '';
        }, function (response) {
        });
    };

    $scope.saveRestService = function (index) {
        var restServiceData = _.clone($scope.api.restServices[index]);
        ApiRepository.saveRestService($scope.api.name, restServiceData).then(function (data) {
            flash.success = 'REST Service updated';
        });
    };

    $scope.removeRestService = function (restServiceName) {
        ApiRepository.removeRestService($scope.api.name, restServiceName)
            .then(function (data) {
                flash.success = 'REST Service deleted';
                $scope.deleteRestService = false;
                $timeout(function () {
                    ApiRepository.getApi($scope.api.name, $scope.api.version, true).then(function (api) {
                        $scope.api = api;
                        $scope.currentVersion = api.currentVersion;
                    });
                }, 500);
            });
    };

    $scope.getSourceCode = function (className, classType) {
        ApiRepository.getSourceCode ($scope.api.name, className)
            .then(function (data) {
                $scope.filename = className + '.php';
                $scope.classType = classType + ' Class';
                if (typeof data.source === 'string') {
                    $scope.sourceCode = $sce.trustAsHtml(data.source);
                } else {
                    $scope.sourceCode = '';
                }
            });
    };
}]);

})(_);

(function(_) {'use strict';

angular.module('ag-admin').controller(
  'ApiRpcServicesController', 
  ['$http', '$rootScope', '$scope', '$timeout', '$sce', 'flash', 'filters', 'validators', 'selectors', 'ApiRepository', 'api', 'toggleSelection', 
  function ($http, $rootScope, $scope, $timeout, $sce, flash, filters, validators, selectors, ApiRepository, api, toggleSelection) {

    $scope.ApiRepository = ApiRepository; // used in child controller (input filters)
    $scope.flash = flash;

    $scope.api = api;

    $scope.toggleSelection = toggleSelection;

    $scope.filterOptions = filters;

    $scope.validatorOptions = validators;

    $scope.selectors = selectors;

    $scope.sourceCode = [];

    $scope.deleteRpcService = false;

    $scope.resetForm = function () {
        $scope.showNewRpcServiceForm = false;
        $scope.rpcServiceName = '';
        $scope.rpcServiceRoute = '';
    };

    $scope.isLatestVersion = function () {
        return $scope.ApiRepository.isLatestVersion($scope.api);
    };

    $scope.createNewRpcService = function () {
        ApiRepository.createNewRpcService($scope.api.name, $scope.rpcServiceName, $scope.rpcServiceRoute).then(function (rpcResource) {
            flash.success = 'New RPC Service created';
            $timeout(function () {
                ApiRepository.getApi($scope.api.name, $scope.api.version, true).then(function (api) {
                    $scope.api = api;
                    $scope.currentVersion = api.currentVersion;
                });
            }, 500);
            $scope.addRpcService = false;
            $scope.resetForm();
        });
    };

    $scope.saveRpcService = function (index) {
        var rpcServiceData = _.clone($scope.api.rpcServices[index]);
        ApiRepository.saveRpcService($scope.api.name, rpcServiceData).then(function (data) {
            flash.success = 'RPC Service updated';
        });
    };

    $scope.removeRpcService = function (rpcServiceName) {
        ApiRepository.removeRpcService($scope.api.name, rpcServiceName)
            .then(function (data) {
                flash.success = 'RPC Service deleted';
                $scope.deleteRpcService = false;
                $timeout(function () {
                    ApiRepository.getApi($scope.api.name, $scope.api.version, true).then(function (api) {
                        $scope.api = api;
                        $scope.currentVersion = api.currentVersion;
                    });
                }, 500);
            });
    };

    $scope.getSourceCode = function (className, classType) {
        ApiRepository.getSourceCode($scope.api.name, className)
            .then(function (data) {
                $scope.filename = className + '.php';
                $scope.classType = classType + ' Class';
                if (typeof data.source === 'string') {
                    $scope.sourceCode = $sce.trustAsHtml(data.source);
                } else {
                    $scope.sourceCode = '';
                }
            });
    };
}]);

})(_);

(function(_) {'use strict';

angular.module('ag-admin').controller('ApiServiceInputController', ['$scope', 'flash', function ($scope, flash) {
    // get services from $parent
    $scope.service = (typeof $scope.$parent.restService != 'undefined') ? $scope.$parent.restService : $scope.$parent.rpcService;
    $scope.filterOptions = $scope.$parent.filterOptions;
    $scope.validatorOptions = $scope.$parent.validatorOptions;

    $scope.addInput = function() {
        // Test first to see if we have a value
        if (!$scope.newInput || $scope.newInput === null || $scope.newInput === '' || $scope.newInput.match(/^\s+$/)) {
            flash.error = "Must provide an input name!";
            return;
        }

        // Test to see if we already have an input by this name first
        var found = false;
        $scope.service.input_filter.every(function (input) {
            if ($scope.newInput === input.name) {
                found = true;
                return false;
            }
            return true;
        });

        if (found) {
            flash.error = "Input by the name " + $scope.newInput + " already exists!";
            return;
        }

        // Add the input to the input filter
        $scope.service.input_filter.push({name: $scope.newInput, required: true, filters: [], validators: []});
        $scope.newInput = '';
    };

    $scope.validateInputName = function (name) {
        // Test first to see if we have a value
        if (!name || name === null || name === '' || name.match(/^\s+$/)) {
            flash.error = "Input name can not be empty!";
            return false;
        }

        // Test to see if we already have an input by this name first
        var found = false;
        $scope.service.input_filter.every(function (input) {
            if (name === input.name) {
                found = true;
                return false;
            }
            return true;
        });

        if (found) {
            flash.error = "Input by the name " + name + " already exists!";
            return false;
        }

        return true;
    };

    $scope.removeInput = function (inputIndex) {
        $scope.service.input_filter.splice(inputIndex, 1);
    };

    $scope.removeOption = function (options, name) {
        delete options[name];
    };

    $scope.addFilter = function (input) {
        input.filters.push({name: input._newFilterName, options: {}});
        input._newFilterName = '';
    };

    $scope.removeFilter = function (input, filterIndex) {
        input.filters.splice(filterIndex, 1);
    };

    $scope.addFilterOption = function (filter) {
        if ($scope.filterOptions[filter.name][filter._newOptionName] == 'bool') {
            filter._newOptionValue = (filter._newOptionValue === 'true');
        }
        filter.options[filter._newOptionName] = filter._newOptionValue;
        filter._newOptionName = '';
        filter._newOptionValue = '';
    };

    $scope.addValidator = function (input) {
        input.validators.push({name: input._newValidatorName, options: {}});
        input._newValidatorName = '';
    };

    $scope.removeValidator = function (input, validatorIndex) {
        input.validators.splice(validatorIndex, 1);
    };

    $scope.addValidatorOption = function (validator) {
        if ($scope.validatorOptions[validator.name][validator._newOptionName] == 'bool') {
            validator._newOptionValue = (validator._newOptionValue === true);
        }
        validator.options[validator._newOptionName] = validator._newOptionValue;
        validator._newOptionName = '';
        validator._newOptionValue = '';
    };

    $scope.saveInput = function () {
        function removeUnderscoreProperties (value, key, collection) {
            if (typeof key == 'string' && ['_', '$'].indexOf(key.charAt(0)) != -1) {
                delete collection[key];
            } else if (value instanceof Object) {
                _.forEach(value, removeUnderscoreProperties);
            }
        }
        var modelInputFilter = _.cloneDeep($scope.service.input_filter);
        _.forEach(modelInputFilter, removeUnderscoreProperties);

        var apiRepo = $scope.$parent.ApiRepository;
        apiRepo.saveInputFilter($scope.service, modelInputFilter);
        $scope.$parent.flash.success = 'Input Filter configuration saved.';
    };
}]);

})(_);

(function() {'use strict';

angular.module('ag-admin').controller(
    'ApiVersionController',
    ['$rootScope', '$scope', '$location', '$timeout', '$routeParams', 'flash', 'ApiRepository', function($rootScope, $scope, $location, $timeout, $routeParams, flash, ApiRepository) {

        ApiRepository.getApi($routeParams.apiName, $routeParams.version).then(function (api) {
            $scope.api = api;
            $scope.currentVersion = api.version;
            $scope.defaultApiVersion = api.default_version;
        });

        $scope.createNewApiVersion = function () {
            ApiRepository.createNewVersion($scope.api.name).then(function (data) {
                flash.success = 'A new version of this API was created';
                $rootScope.$broadcast('refreshApiList');
                $timeout(function () {
                    $location.path('/api/' + $scope.api.name + '/v' + data.version + '/overview');
                }, 500);
            });
        };

        $scope.setDefaultApiVersion = function () {
            flash.info = 'Setting the default API version to ' + $scope.defaultApiVersion;
            ApiRepository.setDefaultApiVersion($scope.api.name, $scope.defaultApiVersion).then(function (data) {
                flash.success = 'Default API version updated';
                $scope.defaultApiVersion = data.version;
            });
        };

        $scope.changeVersion = function () {
            var curPath = $location.path();
            var lastSegment = curPath.substr(curPath.lastIndexOf('/') + 1);
            $timeout(function () {
                $location.path('/api/' + $scope.api.name + '/v' + $scope.currentVersion + '/' + lastSegment);
            }, 500);
        };
    }]
);

})();

(function() {'use strict';

angular.module('ag-admin').controller(
    'AuthenticationController',
    ['$scope', 'flash', 'AuthenticationRepository', function ($scope, flash, AuthenticationRepository) {

    $scope.showSetupButtons                 = false;
    $scope.showHttpBasicAuthenticationForm  = false;
    $scope.showHttpBasicAuthentication      = false;
    $scope.showHttpDigestAuthenticationForm = false;
    $scope.showHttpDigestAuthentication     = false;
    $scope.showOAuth2AuthenticationForm     = false;
    $scope.showOAuth2Authentication         = false;
    $scope.removeAuthenticationForm         = false;
    $scope.httpBasic                        = null;
    $scope.httpDigest                       = null;
    $scope.oauth2                           = null;

    var enableSetupButtons = function () {
        $scope.showSetupButtons             = true;
        $scope.showHttpBasicAuthentication  = false;
        $scope.showHttpDigestAuthentication = false;
        $scope.showOAuth2Authentication     = false;
        $scope.removeAuthenticationForm     = false;
        $scope.httpBasic                    = null;
        $scope.httpDigest                   = null;
        $scope.oauth2                       = null;
    };

    var fetchAuthenticationDetails = function (force) {
        AuthenticationRepository.fetch({cache: !force})
            .then(function (authentication) {
                if (authentication.type == "http_basic") {
                    $scope.showSetupButtons             = false;
                    $scope.showHttpBasicAuthentication  = true;
                    $scope.showHttpDigestAuthentication = false;
                    $scope.showOAuth2Authentication     = false;
                    $scope.httpBasic                    = authentication;
                    $scope.httpDigest                   = null;
                    $scope.oauth2                       = null;
                } else if (authentication.type == "http_digest") {
                    $scope.showSetupButtons             = false;
                    $scope.showHttpDigestAuthentication = true;
                    $scope.showHttpBasicAuthentication  = false;
                    $scope.showOAuth2Authentication     = false;
                    $scope.digest_domains               = authentication.digest_domains.split(" ");
                    $scope.httpDigest                   = authentication;
                    $scope.httpDigest.digest_domains = authentication.digest_domains.split(" ");
                    $scope.httpBasic                    = null;
                    $scope.oauth2                       = null;
                } else if (authentication.type == "oauth2") {
                    $scope.showSetupButtons             = false;
                    $scope.showOAuth2Authentication     = true;
                    $scope.showHttpDigestAuthentication = false;
                    $scope.showHttpBasicAuthentication  = false;
                    $scope.oauth2                       = authentication;
                    $scope.httpDigest                   = null;
                    $scope.httpBasic                    = null;
                } else {
                    enableSetupButtons();
                }
            }, function (err) {
                enableSetupButtons();
                return false;
            }
        );
    };

    var createAuthentication = function (options) {
        AuthenticationRepository.createAuthentication(options).then(
            function success(authentication) {
                flash.success = 'Authentication created';
                fetchAuthenticationDetails(true);
                $scope.removeAuthenticationForm = false;
                $scope.resetForm();
            },
            function error(response) {
                flash.error('Unable to create authentication; please verify that the DSN is valid.');
            }
        );
    };

    var updateAuthentication = function (options) {
        if (options.hasOwnProperty('digest_domains') && typeof options.digest_domains === 'object' && Array.isArray(options.digest_domains)) {
            options.digest_domains = options.digest_domains.join(' ');
        }
        AuthenticationRepository.updateAuthentication(options).then(
            function success(authentication) {
                flash.success = 'Authentication updated';
                fetchAuthenticationDetails(true);
            },
            function error(response) {
                flash.error('Unable to update authentication; please verify that the DSN is valid.');
            }
        );
    };

    $scope.resetForm = function () {
        $scope.showHttpBasicAuthenticationForm  = false;
        $scope.showHttpDigestAuthenticationForm = false;
        $scope.showOAuth2AuthenticationForm     = false;
        $scope.digest_domains                   = '';
        $scope.dsn                              = '';
        $scope.htdigest                         = '';
        $scope.htpasswd                         = '';
        $scope.nonce_timeout                    = '';
        $scope.password                         = '';
        $scope.realm                            = '';
        $scope.route_match                      = '';
        $scope.username                         = '';
    };

    $scope.showAuthenticationSetup = function () {
        if ($scope.showHttpBasicAuthenticationForm || $scope.showHttpDigestAuthenticationForm || $scope.showOAuth2AuthenticationForm) {
            return false;
        }
        return $scope.showSetupButtons;
    };

    $scope.createHttpBasicAuthentication = function () {
        var options = {
            accept_schemes : [ "basic" ],
            realm          : $scope.realm,
            htpasswd       : $scope.htpasswd
        };
        createAuthentication(options);
    };

    $scope.createHttpDigestAuthentication = function () {
        var options = {
            accept_schemes : [ "digest" ],
            realm          : $scope.realm,
            htdigest       : $scope.htdigest,
            digest_domains : $scope.digest_domains.join(" "),
            nonce_timeout  : $scope.nonce_timeout
        };
        createAuthentication(options);
    };

    $scope.createOAuth2Authentication = function () {
        var options = {
            dsn         : $scope.dsn,
            username    : $scope.username,
            password    : $scope.password,
            route_match : $scope.route_match
        };
        createAuthentication(options);
    };

    $scope.updateHttpBasicAuthentication = function () {
        var options = {
            realm          :  $scope.httpBasic.realm,
            htpasswd       :  $scope.httpBasic.htpasswd
        };
        updateAuthentication(options);
    };

    $scope.updateHttpDigestAuthentication = function () {
        var options = {
            realm          : $scope.httpDigest.realm,
            htdigest       : $scope.httpDigest.htdigest,
            digest_domains : $scope.httpDigest.digest_domains.join(" "),
            nonce_timeout  : $scope.httpDigest.nonce_timeout
        };
        updateAuthentication(options);
    };

    $scope.updateOAuth2Authentication = function () {
        var options = {
            dsn         : $scope.oauth2.dsn,
            username    : $scope.oauth2.username,
            password    : $scope.oauth2.password,
            route_match : $scope.oauth2.route_match
        };
        updateAuthentication(options);
    };

    $scope.removeAuthentication = function () {
        AuthenticationRepository.removeAuthentication()
            .then(function (response) {
                flash.success = 'Authentication removed';
                fetchAuthenticationDetails(true);
            });
    };

    fetchAuthenticationDetails(true);
}]);

})();

(function(_) {'use strict';

angular.module('ag-admin').controller(
  'ContentNegotiationController',
  ['$scope', '$location', 'flash', 'selectors', 'ContentNegotiationResource', function ($scope, $location, flash, selectors, ContentNegotiationResource) {
    var newSelector = {
      content_name: '',
      viewModel: '',
      selectors: {}
    };

    $scope.showNewSelectorForm = false;
    $scope.newSelector = _.cloneDeep(newSelector);
    $scope.selectors = _.cloneDeep(selectors);

    $scope.resetNewSelectorForm = function() {
      $scope.showNewSelectorForm = false;
      $scope.newSelector = _.cloneDeep(newSelector);
    };

    $scope.addViewModel = function (viewModel, selector) {
      selector.selectors[viewModel] = [];
      $scope.newSelector.viewModel = '';
    };

    $scope.removeViewModel = function (viewModel, selector) {
      delete selector.selectors[viewModel];
    };

    $scope.resetSelectorForm = function (selector) {
      /* Reset to original values */
      var name = selector.content_name;
      var originalSelector;
      angular.forEach(selectors, function (value) {
        if (originalSelector || value.content_name !== name) {
          return;
        }
        originalSelector = value;
      });
      if (! originalSelector) {
        return;
      }
      angular.forEach($scope.selectors, function (value, key) {
        if (value.content_name !== originalSelector.content_name) {
          return;
        }
        $scope.selectors[key] = originalSelector;
      });
    };

    $scope.createSelector = function() {
      delete $scope.newSelector.viewModel;

      ContentNegotiationResource.createSelector($scope.newSelector).then(function (selector) {
        selectors.push(selector);
        $scope.selectors.push(selector);
        flash.success = 'New selector created';
        $scope.resetNewSelectorForm();
      });
    };

    $scope.updateSelector = function (selector) {
      delete selector.viewModel;
      
      ContentNegotiationResource.updateSelector(selector).then(function (updated) {
        /* Update original selector on success, so that view matches */
        var updatedSelector = false;
        angular.forEach(selectors, function (value, key) {
          if (updatedSelector || value.content_name !== updated.content_name) {
            return;
          }
          selectors[key] = updated;
          updatedSelector = true;
        });

        flash.success = 'Selector updated';
      });

    };

    $scope.removeSelector = function (selectorName) {
      ContentNegotiationResource.removeSelector(selectorName).then(function () {
        flash.success = 'Selector removed';

        ContentNegotiationResource.getList().then(function (updatedSelectors) {
          selectors = updatedSelectors;
          $scope.selectors = _.cloneDeep(selectors);
        });

      });
    };
  }]
);

})(_);

(function() {'use strict';

angular.module('ag-admin').controller(
    'DashboardController',
    ['$rootScope', 'flash', function($rootScope, flash) {
        $rootScope.pageTitle = 'Dashboard';
        $rootScope.pageDescription = 'Global system configuration and configuration to be applied to all APIs.';
    }]
);

})();

(function(_, $) {'use strict';

angular.module('ag-admin').controller(
    'DbAdapterController',
    ['$scope', '$location', 'flash', 'DbAdapterResource', 'dbAdapters', function ($scope, $location, flash, DbAdapterResource, dbAdapters) {
        $scope.dbAdapters = dbAdapters;
        $scope.showNewDbAdapterForm = false;

        $scope.resetForm = function () {
            $scope.showNewDbAdapterForm = false;
            $scope.adapterName = '';
            $scope.driver      = '';
            $scope.database    = '';
            $scope.username    = '';
            $scope.password    = '';
            $scope.hostname    = '';
            $scope.port        = '';
            $scope.charset     = '';
            return true;
        };

        var updateDbAdapters = function (force) {
            $scope.dbAdapters = [];
            DbAdapterResource.getList(force).then(function (updatedAdapters) {
                $scope.dbAdapters = updatedAdapters;
            });
        };

        $scope.createNewDbAdapter = function () {
            var options = {
                adapter_name :  $scope.adapter_name,
                driver       :  $scope.driver,
                database     :  $scope.database,
                username     :  $scope.username,
                password     :  $scope.password,
                hostname     :  $scope.hostname,
                port         :  $scope.port,
                charset      :  $scope.charset
            };
            DbAdapterResource.createNewAdapter(options).then(function (dbAdapter) {
                flash.success = 'Database adapter created';
                updateDbAdapters(true);
                $scope.resetForm();
            });
        };

        $scope.saveDbAdapter = function (index) {
            var dbAdapter = $scope.dbAdapters[index];
            var options = {
                driver   :  dbAdapter.driver,
                database :  dbAdapter.database,
                username :  dbAdapter.username,
                password :  dbAdapter.password,
                hostname :  dbAdapter.hostname,
                port     :  dbAdapter.port,
                charset  :  dbAdapter.charset
            };
            DbAdapterResource.saveAdapter(dbAdapter.adapter_name, options).then(function (dbAdapter) {
                flash.success = 'Database adapter ' + dbAdapter.adapter_name + ' updated';
                updateDbAdapters(true);
            });
        };

        $scope.removeDbAdapter = function (adapter_name) {
            DbAdapterResource.removeAdapter(adapter_name).then(function () {
                flash.success = 'Database adapter ' + adapter_name + ' removed';
                updateDbAdapters(true);
                $scope.deleteDbAdapter = false;
            });
        };

        /* @todo Ideally, this should not be using jquery. Instead, it should
         * likely use a combination of ng-class and ng-click such that ng-click
         * changes a scope variable that will update ng-class. However, until I
         * can figure that out, this will do.
         *
         * Key though: stopPropagation is necessary for those buttons we mark as
         * "data-expand", as we do not want the parent -- the panel header -- to
         * toggle that back closed.
         */
        $scope.clickPanelHeading = function ($event, $index) {
            var panel = $('#collapse' + $index);
            var target = $($event.target);
            if (target.attr('data-expand')) {
                /* target is a button; expand the collapse */
                panel.toggleClass('in', true);
                $event.stopPropagation();
                return false;
            }

            panel.toggleClass('in');
        };

    }]
);

})(_, $);

(function() { 'use strict';

angular.module('ag-admin').directive('agCacheModal', 
    ['CacheEnabledResource',
    function(CacheEnabledResource) {
        var isEnabled = false;
        return {
            restrict: 'E',
            replace: true,
            templateUrl: 'zf-apigility-admin/dist/html/modals/cache-check.html',
            controller: ['$scope', function ($scope) {
                $scope.isEnabled = false;

                CacheEnabledResource.getCacheStatus().then(function (status) {
                    $scope.isEnabled = status;
                });
            }],
            link: function(scope, element, attr) {
                scope.$watch('isEnabled', function (newValue, oldValue) {
                    if (newValue) {
                        element.modal('show');
                    }
                });
            }
        };
    }]
);

})();

(function() {'use strict';

angular.module('ag-admin').directive('collapse', function() {
    return {
        restrict: 'E',
        transclude: true,
        scope: {
            show: '&'
        },
        controller: ['$scope', '$parse', function($scope, $parse) {
            var body;
            var buttons = [];
            var chevron;
            var conditionals = {};
            var head;
            this.noChevron = false;
            var panel = this;
            var watchers = {};

            this.addButton = function(button) {
                /* Ensure we have boolean values for criteria flags */
                angular.forEach(button.criteria, function(flag, key) {
                    button.criteria[key] = !!flag;
                });
                buttons.push(button);
            };

            $scope.setConditionals = function(newConditionals) {
                angular.forEach(newConditionals, function(value, key) {
                    conditionals[key] = !!value;
                });
            };

            $scope.setNoChevron = function(flag) {
                panel.noChevron = !!flag;
                if (chevron) {
                    chevron.remove();
                }
            };

            this.setFlags = function(flags) {
                angular.forEach(flags, function(value, flag) {
                    if (watchers.hasOwnProperty(flag)) {
                        /* Trigger all watchers on this flag */
                        angular.forEach(watchers[flag], function(watcher) {
                            watcher(value);
                        });
                    } else {
                        conditionals[flag] = !!value;
                    }
                });
            };

            this.addConditionalWatcher = function(conditionalCriteria, element) {
                angular.forEach(conditionalCriteria, function(value, flag) {
                    if (!conditionals.hasOwnProperty(flag)) {
                        conditionals[flag] = false;
                    }

                    /* cast to bool */
                    value = !!value;
                    
                    /* ensure we have an array of watchers for a given flag */
                    if (typeof watchers[flag] === 'undefined') {
                        watchers[flag] = [];
                    }

                    watchers[flag].push(function(newVal) {
                        /* cast to bool */
                        newVal = !!newVal;
                        conditionals[flag] = newVal;
                        element.toggleClass('hide', value !== newVal);
                    });
                });
            };

            $scope.showContainerButtons = this.showContainerButtons = function() {
                var criteria = false;
                angular.forEach(buttons, function(button) {
                    var currentCriteria = criteria;
                    angular.forEach(button.criteria, function(test, criteriaProp) {
                        if (! conditionals.hasOwnProperty(criteriaProp)) {
                            return;
                        }
                        currentCriteria = currentCriteria || (conditionals[criteriaProp] !== test);
                    });
                    button.element.toggleClass('hide', currentCriteria);
                });
            };

            $scope.hideContainerButtons = this.hideContainerButtons = function(state) {
                var bodyExpanded = body.hasClass('in');
                angular.forEach(buttons, function(button) {
                    if (state.hasOwnProperty('leave') && state.leave) {
                        button.element.toggleClass('hide', true);
                        return;
                    }

                    var currentCriteria = true;
                    angular.forEach(button.criteria, function(test, criteriaProp) {
                        if (!currentCriteria) {
                            return;
                        }
                        if (! conditionals.hasOwnProperty(criteriaProp)) {
                            return;
                        }
                        currentCriteria = (conditionals[criteriaProp] === test);
                    });
                    button.element.toggleClass('hide', currentCriteria);
                });
            };

            this.setHead = function (headScope) {
                head = headScope;
            };

            this.setBody = function (bodyElement) {
                body = bodyElement;
                if (body.hasClass('in')) {
                    panel.toggleChevron('up');
                }

                $scope.$watch(function () {
                    return body.attr('class');
                }, function (newClass) {
                    if (body.hasClass('in')) {
                        panel.toggleChevron('up');
                    } else {
                        panel.toggleChevron('down');
                    }
                });
            };

            this.setChevron = function (chevronElement) {
                chevron = chevronElement;
            };

            this.expand = function() {
                body.addClass('in');
            };

            this.collapse = function() {
                body.removeClass('in');
            };

            this.toggle = function() {
                body.toggleClass('in');
                panel.toggleChevron();
            };

            this.toggleChevron = function (flag) {
                if (panel.noChevron) {
                    return;
                }

                if (typeof flag === 'undefined' || flag === null) {
                    if (body.hasClass('in')) {
                        flag = 'up';
                    } else {
                        flag = 'down';
                    }
                }

                var start = (flag === 'up')  ? 'down' : 'up';
                var end   = (start === 'up') ? 'down' : 'up';

                var startClass = 'glyphicon-chevron-' + start;
                var endClass   = 'glyphicon-chevron-' + end;

                if (chevron.hasClass(startClass)) {
                    chevron.removeClass(startClass);
                    chevron.addClass(endClass);
                }
            };
        }],
        link: function(scope, element, attr) {
            if (attr.hasOwnProperty('show') && 
                typeof scope.show === 'function') {
                if (!scope.show()) {
                    element.toggleClass('hide', true);
                }
            }

            if (attr.hasOwnProperty('conditionals')) {
                scope.setConditionals(scope.$eval(attr.conditionals));
            }

            if (attr.hasOwnProperty('noChevron')) {
                scope.setNoChevron(true);
            }
        },
        template: '<div class="panel" ng-transclude></div>',
        replace: true
    };
}).directive('collapseHeader', function () {
    /* <collapse-header ...></collapse-header> */
    return {
        require: '^collapse',
        restrict: 'E',
        transclude: true,
        link: function(scope, element, attr, panelCtrl) {
            panelCtrl.setHead(scope);

            if (!panelCtrl.noChevron) {
                var chevron = angular.element('<i class="glyphicon glyphicon-chevron-down"></i>');
                var chevronWrapper = angular.element('<div class="ag-chevron pull-right"></div>');
                chevronWrapper.append(chevron);
                element.prepend(chevronWrapper);
                panelCtrl.setChevron(chevron);
            }

            element.on('click', function(event) {
                panelCtrl.toggle();
            });

            element.on('mouseover', function(event) {
                panelCtrl.showContainerButtons();
            });

            element.on('mouseleave', function(event) {
                panelCtrl.hideContainerButtons({leave: true});
            });
        },
        template: '<div class="panel-heading" ng-transclude></div>',
        replace: true
    };
}).directive('collapseBody', function () {
    /* <collapse-body ...></collapse-body> */
    return {
        require: '^collapse',
        restrict: 'E',
        transclude: true,
        link: function(scope, element, attr, panelCtrl) {
            panelCtrl.setBody(element);
        },
        template: '<div class="panel-collapse collapse" ng-transclude></div>',
        replace: true
    };
}).directive('collapseButton', function () {
    /* <collapse-button [criteria="{...}"]>...</collapse-button> */
    return {
        require: '^collapse',
        restrict: 'A',
        link: function(scope, element, attr, panelCtrl) {
            var criteria = {};
            if (attr.hasOwnProperty('criteria')) {
                criteria = scope.$eval(attr.criteria);
                if (typeof criteria !== 'object') {
                    criteria = {};
                }
            }

            panelCtrl.addButton({criteria: criteria, element: element});

            element.addClass('hide');

            element.on('click', function(event) {
                panelCtrl.expand();
                panelCtrl.showContainerButtons();
                event.stopPropagation();
            });
        }
    };
}).directive('collapseFlag', function() {
    /* <a collapse-flag flags="{...}"></a> */
    return {
        require: '^collapse',
        restrict: 'A',
        link: function(scope, element, attr, panelCtrl) {
            if (!attr.hasOwnProperty('flags')) {
                return;
            }

            var flags = scope.$eval(attr.flags);

            if (typeof flags !== 'object') {
                return;
            }

            element.on('click', function(event) {
                panelCtrl.setFlags(flags);
            });
        }
    };
}).directive('collapseShow', function() {
    /* <div collapse-show criteria="{...}" class="hide">...</div> */
    return {
        require: '^collapse',
        restrict: 'A',
        link: function(scope, element, attr, panelCtrl) {
            if (!attr.hasOwnProperty('criteria')) {
                return;
            }

            var criteria = scope.$eval(attr.criteria);

            if (typeof criteria !== 'object') {
                return;
            }

            panelCtrl.addConditionalWatcher(criteria, element);
        }
    };
});

})();

(function() {'use strict';

/* <ag-comment>Comment you want stripped here</ag-comment> */
angular.module('ag-admin').directive('agComment', function() {
  return {
    restrict: 'E',
    compile: function(element, attr) {
        element.replaceWith('');
    }
  };
});

})();


(function() {'use strict';

angular.module('ag-admin').directive('agEditInplace', function() {
    return {
        restrict: 'E',
        replace: true,
        scope: {
            'agInputName': '=name',
            validate: '&'
        },
        templateUrl: 'zf-apigility-admin/dist/html/directives/ag-edit-inplace.html',
        controller: ['$scope', function($scope) {
            var initialValue;

            $scope.isFormVisible = false;

            $scope.setInitialValue = function (value) {
                initialValue = value;
            };

            $scope.resetForm = function () {
                $scope.agInputName = initialValue;
                $scope.isFormVisible = false;
            };
        }],
        link: function(scope, element, attr) {
            element.on('click', function(event) {
                event.stopPropagation();
            });

            scope.setInitialValue(scope.agInputName);

            var name = angular.element(element.children()[0]);
            var form = angular.element(element.children()[1]);

            if (attr.hasOwnProperty('validate') &&
                typeof scope.validate === 'function') {
                form.on('submit', function (event) {
                    if (scope.validate(scope.agInputName)) {
                        scope.isFormVisible = false;
                    }
                });
            } else {
                form.on('submit', function (event) {
                    scope.isFormVisible = false;
                });
            }

            scope.$watch('isFormVisible', function(newVal) {
                if (newVal) {
                    name.toggleClass('hide', true);
                    form.toggleClass('hide', false);
                    return;
                }

                name.toggleClass('hide', false);
                form.toggleClass('hide', true);
            });
        }
    };
});

})();

(function() {'use strict';

angular.module('ag-admin').directive('agHover', function() {
  return {
    restrict: 'A',
    controller: ['$scope', function($scope) {
      var target;

      this.setTarget = function(element) {
        target = element;
      };

      this.toggleHide = $scope.toggleHide = function(flag) {
        target.toggleClass('hide', flag);
      };
    }],
    link: function(scope, element, attr) {
      element.on('mouseover', function(event) {
        scope.toggleHide(false);
      });

      element.on('mouseleave', function(event) {
        scope.toggleHide(true);
      });
    }
  };
}).directive('agHoverTarget', function() {
  return {
    require: '^agHover',
    restrict: 'A',
    link: function(scope, element, attr, hoverCtrl) {
      if (hoverCtrl) {
        hoverCtrl.setTarget(element);
        hoverCtrl.toggleHide(true);
      }
    }
  };
});

})();

(function(console) { 'use strict';

angular.module('ag-admin').directive('agInclude', [
    '$http', '$templateCache', '$compile',
    function($http, $templateCache, $compile) {
        return {
            restrict: 'E',
            transclude: true,
            replace: true,
            link: function(scope, element, attr) {
                if (!attr.hasOwnProperty('src')) {
                    console.error('ag-include requires a "src" attribute; none provided!');
                    return;
                }

                $http.get(attr.src, {cache: $templateCache})
                    .success(function(response) {
                        var contents = angular.element('<div/>').html(response).contents();
                        element.html(contents);
                        $compile(contents)(scope);
                    });
            }
        };
    }
]);

})(console);

(function() { 'use strict';

angular.module('ag-admin').directive('agModalDismiss', function() {
    return {
        restrict: 'A',
        link: function(scope, element, attr) {
            scope.dismissModal = function() {
                element.modal('hide');
            };
        }
    };
});

})();

(function() {'use strict';
/**
 * Borrowed from http://errietta.me/blog/bootstrap-angularjs-directives/
 */

/* <ag-tabs [parent="..."] ...>[<ag-tab-pane ...></ag-tab-pane>]</ag-tabs> */
angular.module('ag-admin').directive('agTabs', function() {
    return {
        restrict: 'E',
        transclude: true,
        scope: {
            parent: '='
        },
        controller: ['$scope', '$element', function($scope, $element) {
            var panes = $scope.panes = [];

            $scope.select = function(pane) {
                angular.forEach(panes, function(pane) {
                    pane.selected = false;
                });

                pane.selected = true;
            };

            this.addPane = function(pane) {
                if (panes.length === 0)
                    $scope.select(pane);

                panes.push(pane);
            };
        }],
        link: function (scope, element, attr) {
            var tabType = 'nav-tabs';
            if (attr.hasOwnProperty('pills')) {
                tabType = 'nav-pills';
            }
            angular.forEach(element.children(), function (child) {
                child = angular.element(child);
                if (child.context.tagName !== 'UL') {
                    return;
                }
                child.addClass(tabType);
            });
        },
        template: '<div class="ag-tabs">' +
            '<ul class="nav">' +
            '<li ng-repeat="pane in panes" ng-class="{active:pane.selected}">'+
            '<a href="" ng-click="select(pane)">{{pane.title}}</a>' +
            '</li>' +
            '</ul>' +
            '<div class="tab-content" ng-transclude></div>' +
            '</div>',
        replace: true
    };
}).directive('agTabPane', function() {
    /* <ag-tab-pane ...></ag-tab-pane> */
    return {
        require: '^agTabs',
        restrict: 'E',
        transclude: true,
        scope: { title: '@' },
        link: function(scope, element, attrs, tabsCtrl) {
            tabsCtrl.addPane(scope);
        },
        template:
        '<div class="tab-pane" ng-class="{active: selected}" ng-transclude>' +
        '</div>',
        replace: true
    };
});

})();

(function() {'use strict';

// @todo refactor the naming of this at some point
angular.module('ag-admin').filter('servicetype', function () {
    return function (input) {
        var parts = input.split('::');
        switch (parts[1]) {
            case '__collection__': return '(Collection)';
            case '__resource__':   return '(Entity)';
            default: return '';
        }
    };
});

})();


(function() {'use strict';

// Used to strip out the backslash characters to use as a part of a class id
angular.module('ag-admin').filter('namespaceclassid', function () {
    return function (input) {
        return input.replace(/\\/g, '_');
    };
});

})();

(function() {'use strict';

// @todo refactor the naming of this at some point
angular.module('ag-admin').filter('servicename', function () {
    return function (input) {
        /* For controller service name like "Status\V3\Rest\Message\Controller",
         * return "Message"
         */
        var r = /^[^\\]+\\{1,2}V[^\\]+\\{1,2}(Rest|Rpc)\\{1,2}([^\\]+)\\{1,2}.*?Controller.*?$/;
        if (!input.match(r)) {
            return input;
        }
        return input.replace(r, '$2');
    };
});

})();

(function(_) {'use strict';

angular.module('ag-admin').factory('ApiAuthorizationRepository', ['$http', 'apiBasePath', 'Hal', function ($http, apiBasePath, Hal) {
    return {
        getApiAuthorization: function (name, version, force) {
            force = !!force;

            if (typeof version == 'string') {
                version = parseInt(version.match(/\d/g)[0], 10);
            }

            var config = {
                method: 'GET',
                url: apiBasePath + '/module/' + name + '/authorization',
                params: {
                    version: version
                },
                cache: !force
            };

            return $http(config).then(
                function success(response) {
                    return Hal.props(response.data);
                }
            );
        },

        getServiceAuthorizations: function (service, moduleName, version) {
            return this.getApiAuthorization(moduleName, version).then(function (apiAuthorizations) {
                var authorizations = {};
                var complete = false;
                var matches;
                var controllerServiceName = service.controller_service_name;
                controllerServiceName = controllerServiceName.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
                var serviceRegex = new RegExp('^' + controllerServiceName + '::(.*?)$');
                var actionRegex  = new RegExp('^__([^_]+)__$');
                _.forEach(apiAuthorizations, function (data, serviceName) {
                    if (complete) {
                        return;
                    }

                    matches = serviceRegex.exec(serviceName);
                    if (!Array.isArray(matches)) {
                        return;
                    }

                    var action = matches[1];
                    matches = actionRegex.exec(action);
                    if (Array.isArray(matches)) {
                        var type = matches[1];
                        if (type == 'resource') {
                            type = 'entity';
                        }
                        authorizations[type] = data;
                        return;
                    }

                    authorizations = data;
                    complete = true;
                });

                return authorizations;
            });
        },

        saveApiAuthorizations: function (apiName, apiAuthorizationsModel) {
            var url = apiBasePath + '/module/' + apiName + '/authorization';
            return $http.put(url, apiAuthorizationsModel).then(function (response) {
                return Hal.props(response.data);
            });
        }
    };
}]);

})(_);

(function(_) {'use strict';

angular.module('ag-admin').factory('ApiRepository', ['$q', '$http', 'apiBasePath', 'Hal', function ($q, $http, apiBasePath, Hal) {
    var moduleApiPath = apiBasePath + '/module';

    return {
        currentApiModel: null,

        getList: function (force) {
            force = !!force;
            var apisModel = [];
            var config = {
                method: 'GET',
                url: moduleApiPath,
                cache: !force
            };

            return $http(config).then(
                function success(response) {
                    var apis = Hal.pluckCollection('module', response.data);
                    apis = Hal.stripLinks(apis);
                    return Hal.stripEmbedded(apis);
                }
            );
        },

        getApi: function (name, version, force) {
            force = !!force;
            var apiModel = {};
            var deferred = $q.defer();

            // localize this for future use
            var self = this;

            if (typeof version == 'string') {
                version = parseInt(version.match(/\d/g)[0], 10);
            }

            if (!force && self.currentApiModel && version && self.currentApiModel.name == name && self.currentApiModel.version == version) {
                deferred.resolve(self.currentApiModel);
                return deferred.promise;
            }

            var config = {
                method: 'GET',
                url: moduleApiPath,
                cache: !force
            };
            $http(config).then(function (response) {
                var apis = Hal.pluckCollection('module', response.data);
                var api = _.find(apis, function (m) {
                    return m.name === name;
                });

                _.forEach(Hal.stripLinks(api), function (value, key) {
                    apiModel[key] = value;
                });

                apiModel.restServices = [];
                apiModel.rpcServices  = [];

                if (!version) {
                    version = api.versions[api.versions.length - 1];
                }

                return api;
            }).then(function (api) {
                // Now load REST endpoints
                var config = self.getHttpConfigFromLink('rest', api);
                config.method = 'GET';
                config.params.version = version;
                return $http(config).then(function (response) {
                    apiModel.restServices = Hal.pluckCollection('rest', response.data);
                    _.forEach(apiModel.restServices, function (restService, index) {
                        restService._self = Hal.getLink('self', restService);
                        restService.input_filter = {};
                        restService.documentation = {};
                        if (! restService._embedded) {
                            return;
                        }

                        if (restService._embedded && restService._embedded.input_filters && restService._embedded.input_filters[0]) {
                            restService.input_filter = Hal.props(restService._embedded.input_filters[0]);
                            _.forEach(restService.input_filter, function (value, key) {
                                self.marshalInputFilter(restService, value, key);
                            });
                            restService.input_filter = _.toArray(restService.input_filter);
                        }

                        if (restService._embedded.documentation) {
                            var documentation = Hal.pluckCollection('documentation', restService);
                            restService.documentation = Hal.props(documentation);
                        }
                    });
                    return api;
                });
            }).then(function (api) {
                var config = self.getHttpConfigFromLink('rpc', api);
                config.method = 'GET';
                config.params.version = version;
                return $http(config).then(function (response) {
                    apiModel.rpcServices = Hal.pluckCollection('rpc', response.data);
                    _.forEach(apiModel.rpcServices, function (rpcService, index) {
                        rpcService._self = Hal.getLink('self', rpcService);
                        rpcService.input_filter = {};
                        rpcService.documentation = {};
                        if (! rpcService._embedded) {
                            return;
                        }

                        if (rpcService._embedded.input_filters && rpcService._embedded.input_filters[0]) {
                            rpcService.input_filter = Hal.props(rpcService._embedded.input_filters[0]);
                            _.forEach(rpcService.input_filter, function (value, key) {
                                self.marshalInputFilter(rpcService, value, key);
                            });
                            rpcService.input_filter = _.toArray(rpcService.input_filter);
                        }

                        if (rpcService._embedded.documentation) {
                            var documentation = Hal.pluckCollection('documentation', rpcService);
                            rpcService.documentation = Hal.props(documentation);
                        }
                    });
                    return api;
                });
            }).then(function (api) {
                deferred.resolve(apiModel);
                self.currentApiModel = apiModel;
                self.currentApiModel.version = version;
             });

            return deferred.promise;
        },

        createNewApi: function (name) {
            return $http.post(moduleApiPath, {name: name})
                .then(function (response) {
                    return response.data;
                });
        },

        createNewRestService: function (apiName, restServiceName) {
            return $http.post(moduleApiPath + '/' + apiName + '/rest', {resource_name: restServiceName})
                .then(function (response) {
                    return response.data;
                });
        },

        createNewDbConnectedService: function(apiName, dbAdapterName, dbTableName) {
            return $http.post(moduleApiPath + '/' + apiName + '/rest', {adapter_name: dbAdapterName, table_name: dbTableName})
                .then(function (response) {
                    return response.data;
                });
        },

        createNewRpcService: function (apiName, rpcServiceName, rpcServiceRoute) {
            return $http.post(moduleApiPath + '/' + apiName + '/rpc', {service_name: rpcServiceName, route: rpcServiceRoute})
                .then(function (response) {
                    return response.data;
                });
        },

        removeRestService: function (apiName, restServiceName) {
            var url = moduleApiPath + '/' + apiName + '/rest/' + encodeURIComponent(restServiceName);
            return $http.delete(url)
                .then(function (response) {
                    return response.data;
                });
        },

        saveRestService: function (apiName, restService) {
            var url = moduleApiPath + '/' + apiName + '/rest/' + encodeURIComponent(restService.controller_service_name);
            return $http({method: 'patch', url: url, data: restService})
                .then(function (response) {
                    return response.data;
                });
        },

        saveInputFilter: function (api, inputFilter) {
            var url = api._self + '/input-filter';
            return $http.put(url, inputFilter);
        },

        saveDocumentation: function (api) {
            var url = api._self + '/doc';
            return $http.put(url, api.documentation);
        },

        removeRpcService: function (apiName, rpcServiceName) {
            var url = moduleApiPath + '/' + apiName + '/rpc/' + encodeURIComponent(rpcServiceName);
            return $http.delete(url)
                .then(function (response) {
                    return response.data;
                });
        },

        saveRpcService: function (apiName, rpcService) {
            var url = moduleApiPath + '/' + apiName + '/rpc/' + encodeURIComponent(rpcService.controller_service_name);
            return $http({method: 'patch', url: url, data: rpcService})
                .then(function (response) {
                    return response.data;
                });
        },

        getSourceCode: function (apiName, className) {
            return $http.get(apiBasePath + '/source?module=' + apiName + '&class=' + className)
                .then(function(response) {
                    return response.data;
                });
        },

        createNewVersion: function (apiName) {
            return $http({method: 'patch', url: apiBasePath + '/versioning', data: {module: apiName}})
                .then(function (response) {
                    return response.data;
                });
        },

        setDefaultApiVersion: function (apiName, defaultApiVersion) {
            return $http({method: 'patch', url: '/admin/api/default-version', data: {module: apiName, version: defaultApiVersion}})
                .then(function (response) {
                    return response.data;
                });
        },

        getLatestVersion: function (api) {
            var versions = api.versions;
            var latest = versions.pop();
            versions.push(latest);
            return latest;
        },

        isLatestVersion: function (api) {
            var latest = this.getLatestVersion(api);
            return (api.version === latest);
        },

        marshalInputFilter: function (service, data, key) {
            if (typeof data == 'string') {
                delete service.input_filter[key];
                return;
            }

            if (typeof data.validators == 'undefined') {
                data.validators = [];
            } else {
                _.forEach(data.validators, function (validator, index) {
                    if (typeof validator.options == 'undefined' || validator.options.length === 0) {
                        validator.options = {};
                    }
                });
            }

            if (typeof data.filters == 'undefined') {
                data.filters = [];
            } else {
                _.forEach(data.filters, function (filter, index) {
                    if (typeof filter.options == 'undefined' || filter.options.length === 0) {
                        filter.options = {};
                    }
                });
            }

            if (typeof data.required == 'undefined') {
                data.required = true;
            } else {
                data.required = !!data.required;
            }

            if (typeof data.allow_empty == 'undefined') {
                data.allow_empty = false;
            } else {
                data.allow_empty = !!data.allow_empty;
            }

            if (typeof data.continue_if_empty == 'undefined') {
                data.continue_if_empty = false;
            } else {
                data.continue_if_empty = !!data.continue_if_empty;
            }
        },

        getHttpConfigFromLink: function (rel, resource) {
            var config  = {
                uri: null,
                params: {}
            };

            var uri = Hal.getLink(rel, resource);

            // Remove templates
            uri = uri.replace(/\{[^}]+\}/, '', 'g');

            // Check for query string
            var matches = uri.match(/^([^?]+)\?(.*?)$/);
            if (!Array.isArray(matches)) {
                config.url = uri;
                return config;
            }

            // Split query string into key/value pairs
            config.url = matches[1];
            config.params = {};
            var paramPairs = matches[2].split('&');
            _.forEach(paramPairs, function (pair, index) {
                if (!pair.match(/\=/)) {
                    config.params[pair] = true;
                    return;
                }
                pair = pair.split('=', 2);
                config.params[pair[0]] = pair[1];
            });
            return config;
        }
    };
}]);

})(_);

(function() {'use strict';

angular.module('ag-admin').factory(
    'AuthenticationRepository',
    ['$http', '$q', 'apiBasePath', function ($http, $q, apiBasePath) {

        var authenticationPath = apiBasePath + '/authentication';

        return {
            hasAuthentication: function() {
                return this.fetch({cache: false}).then(
                    function success(response) {
                        var configured = true;
                        if (response === '') {
                            configured = false;
                        }
                        return { configured: configured };
                    },
                    function error(response) {
                        return { configured: false };
                    }
                );
            },
            fetch: function(options) {
                return $http.get(authenticationPath, options)
                    .then(function (response) {
                        return response.data;
                    });
            },
            createAuthentication: function (options) {
                return $http.post(authenticationPath, options)
                    .then(function (response) {
                        return response.data;
                    });
            },
            updateAuthentication: function (data) {
                return $http({method: 'patch', url: authenticationPath, data: data})
                    .then(function (response) {
                        return response.data;
                    });
            },
            removeAuthentication: function () {
                return $http.delete(authenticationPath)
                    .then(function (response) {
                    return true;
                }, function (error) {
                    return false;
                });
            }
        };
    }]
);

})();

(function() {'use strict';

angular.module('ag-admin').factory(
  'CacheEnabledResource',
  ['$http', 'flash', 'apiBasePath',
  function ($http, flash, apiBasePath) {

    var servicePath = apiBasePath + '/cache-enabled';

    return {
      getCacheStatus: function () {
        return $http({method: 'GET', url: servicePath}).then(
          function success(response) {
            return response.data.cache_enabled;
          },
          function error() {
            flash.error = 'Unable to fetch API opcode cache status; you may need to refresh the page.';
          }
        );
      }
    };
  }]
);

})();

(function() {'use strict';

angular.module('ag-admin').factory(
  'ContentNegotiationResource',
  ['$http', 'flash', 'apiBasePath',
  function ($http, flash, apiBasePath) {

    var servicePath = apiBasePath + '/content-negotiation';

    return {
      prepareSelector: function (selector) {
        var data = {
          content_name: selector.content_name
        };

        angular.forEach(selector.selectors, function (value, key) {
          data[key] = value;
        });

        return data;
      },

      getList: function () {
        return $http({method: 'GET', url: servicePath}).then(
          function success(response) {
            return response.data._embedded.selectors;
          },
          function error() {
            flash.error = 'Unable to fetch content negotiation selectors; you may need to reload the page';
          }
        );
      },

      createSelector: function (selector) {
        return $http({
          method: 'POST',
          url: servicePath,
          data: this.prepareSelector(selector)
        }).then(
          function success(response) {
            return response.data;
          },
          function error(response) {
            flash.error = 'Unable to create selector; please try again';
            return response;
          }
        );
      },

      updateSelector: function (selector) {
        var updatePath = servicePath + '/' + encodeURIComponent(selector.content_name);

        var data = this.prepareSelector(selector);
        delete data.content_name;

        return $http({
          method: 'PATCH',
          url: updatePath,
          data: data
        }).then(
          function success(response) {
            return response.data;
          },
          function error(response) {
            flash.error = 'Unable to create selector; please try again';
            return response;
          }
        );
      },

      removeSelector: function (selectorName) {
        var updatePath = servicePath + '/' + encodeURIComponent(selectorName);

        return $http({
          method: 'DELETE',
          url: updatePath
        }).then(
          function success(response) {
            return response.data;
          },
          function error(response) {
            flash.error = 'Unable to remove selector; please try again';
            return response;
          }
        );
      }
    };
  }]
);

})();

(function(_) {'use strict';

angular.module('ag-admin').factory('DbAdapterResource', ['$http', 'apiBasePath', 'Hal', function ($http, apiBasePath, Hal) {

    var dbAdapterApiPath = apiBasePath + '/db-adapter';

    return {
        getList: function (force) {
            force = !!force;
            var config = {
                method: 'GET',
                url: dbAdapterApiPath,
                cache: !force
            };
            return $http(config).then(
                function success(response) {
                    var dbAdapters = Hal.pluckCollection('db_adapter', response.data);
                    return Hal.props(dbAdapters);
                }
            );
        },

        createNewAdapter: function (options) {
            return $http.post(dbAdapterApiPath, options)
                .then(function (response) {
                    return Hal.props(response.data);
                });
        },

        saveAdapter: function (name, data) {
            return $http({method: 'patch', url: dbAdapterApiPath + '/' + encodeURIComponent(name), data: data})
                .then(function (response) {
                    return Hal.props(response.data);
                });
        },

        removeAdapter: function (name) {
            return $http.delete(dbAdapterApiPath + '/' + encodeURIComponent(name))
                .then(function (response) {
                    return true;
                });
        }
    };
}]);

})(_);

(function() {'use strict';

angular.module('ag-admin').factory(
    'FiltersServicesRepository',
    ['$http', 'flash', 'apiBasePath', function ($http, flash, apiBasePath) {
        var servicePath = apiBasePath + '/filters';

        return {
            getList: function () {
                var promise = $http({method: 'GET', url: servicePath}).then(
                    function success(response) {
                        return response.data.filters;
                    },
                    function error() {
                        flash.error = 'Unable to fetch filters for filter dropdown; you may need to reload the page';
                        return false;
                    }
                );
                return promise;
            }
        };
    }]
);

})();

(function(_) {'use strict';

angular.module('ag-admin').factory('Hal', function () {
    return {
        props: function (resource) {
            resource = this.stripLinks(resource);
            return this.stripEmbedded(resource);
        },

        stripLinks: function (resource) {
            if (typeof resource != 'object') {
                return resource;
            }

            if (Array.isArray(resource)) {
                var self = this;
                _.forEach(resource, function (resourceItem, key) {
                    resource.key = self.stripLinks(resourceItem);
                });
                return resource;
            }

            if (! resource._links) {
                return resource;
            }

            var clone = _.cloneDeep(resource);
            delete clone._links;
            return clone;
        },
        stripEmbedded: function (resource) {
            if (typeof resource != 'object') {
                return resource;
            }

            if (Array.isArray(resource)) {
                var self = this;
                _.forEach(resource, function (resourceItem, key) {
                    resource.key = self.stripEmbedded(resourceItem);
                });
                return resource;
            }

            if (! resource._embedded) {
                return resource;
            }

            var clone = _.cloneDeep(resource);
            delete clone._embedded;
            return clone;
        },
        pluckCollection: function (prop, resource) {
            if (typeof resource != 'object' || Array.isArray(resource)) {
                return [];
            }
            if (! resource._embedded) {
                return [];
            }
            if (! resource._embedded[prop]) {
                return [];
            }

            var collection = _.cloneDeep(resource._embedded[prop]);
            return collection;
        },

        getLink: function (rel, resource) {
            if (typeof resource != 'object' || Array.isArray(resource)) {
                return false;
            }

            if (! resource._links || ! resource._links[rel] || ! resource._links[rel].href) {
                return false;
            }

            return resource._links[rel].href;
        }
    };
});

})(_);

(function() {'use strict';

angular.module('ag-admin').factory(
    'HydratorServicesRepository',
    ['$http', 'flash', 'apiBasePath', function ($http, flash, apiBasePath) {
        var servicePath = apiBasePath + '/hydrators';

        return {
            getList: function () {
                var promise = $http({method: 'GET', url: servicePath}).then(
                    function success(response) {
                        return response.data.hydrators;
                    },
                    function error() {
                        flash.error = 'Unable to fetch hydrators for hydrator dropdown; you may need to reload the page';
                    }
                );
                return promise;
            }
        };
    }]
);

})();

(function() {'use strict';

angular.module('ag-admin').factory(
    'toggleSelection',
    function () {
        return function (model, $event) {
            var element = $event.target;
            if (element.checked) {
                model.push(element.value);
            } else {
                model.splice(model.indexOf(element.value), 1);
            }
        };
    }
);

})();

(function() {'use strict';

angular.module('ag-admin').factory(
    'ValidatorsServicesRepository',
    ['$http', 'flash', 'apiBasePath', function ($http, flash, apiBasePath) {
        var servicePath = apiBasePath + '/validators';

        return {
            getList: function () {
                var promise = $http({method: 'GET', url: servicePath}).then(
                    function success(response) {
                        return response.data.validators;
                    },
                    function error() {
                        flash.error = 'Unable to fetch validators for validator dropdown; you may need to reload the page';
                        return false;
                    }
                );
                return promise;
            }
        };
    }]
);

})();

(function() {'use strict';

angular.module('ag-admin').run([
    '$rootScope', '$routeParams', '$location', '$route', 
    function ($rootScope, $routeParams, $location, $route) {
        $rootScope.routeParams = $routeParams;

        $rootScope.$on('$routeChangeSuccess', function(scope, next, current){
            scope.targetScope.$root.navSection = $route.current.controller;
            if (next.locals.api && scope.targetScope.$root.pageTitle != next.locals.api.name) {
                scope.targetScope.$root.pageTitle = next.locals.api.name;
            }
        });
    }
]);

})();
