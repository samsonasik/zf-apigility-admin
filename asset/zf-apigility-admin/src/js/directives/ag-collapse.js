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
