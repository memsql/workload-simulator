var global_query_id = 0;
var query_widget_map = {}

var dial_max_value = 10000;

function QueryWidget() {
    var _this = this;

    _this.initialize = function() {
        var _this = this;
        _this.query_id = global_query_id++;
        query_widget_map[this.query_id] = _this;

        _this.dialValue = 0;

        _this.dom = $("#empty_widget").clone();

        _this.dom.data('query_id', _this.query_id)
        _this.dom.attr('id', 'query_widget_' + _this.query_id);

        _this.dom.addClass('widget');
        _this.dom.css('display', 'none');
        _this.replaceDial(false, 0);
        _this.dom.css('display', 'block');

        _this.dom.click(function() {
            if (_this.err_ele) {
                _this.err_ele.fadeOut(1000);
                _this.dom.css('border-color', _this.original_border_color);
                _this.err_ele = null;
            }
        });


        _this.original_border_color = _this.dom.css('border-color');

        $("#new-widget").before(_this.dom);
        adjustWidgetMargins();

        var close_widget = _this.dom.find('.close-widget');
        close_widget.data('query_id', _this.query_id);
        close_widget.click(function() {
            var _e = $(this);
            var query_id = _e.data('query_id');
            var widget = query_widget_map[query_id];
            widget.delete();
        });

        // Setup CodeMirror
        _this.codemirror = CodeMirror(_this.dom.find('.query-text').get()[0], {
            mode  : 'mysql',
            lineWrapping : true
        });

        _this.dom.find('textarea').attr('id', 'code_mirror_' + _this.query_id);

        if (!livemode)
        {
            _this.codemirror.focus();
        }
    }

    _this.delete = function() {
        _this.dom.detach();
        delete query_widget_map[_this.query_id];
        adjustWidgetMargins();
    };

    _this.highlight_error = function(message) {
        _this.dom.css('border-color', 'red');
        _this.err_ele = $("#empty-error").clone();
        _this.err_ele.removeAttr('id');
        _this.err_ele.find('.error-message').html(message);
        _this.err_ele.css('display', 'block');
        _this.dom.find('.query-error-message-container').append(_this.err_ele);
    }

    _this.setDialValue = function(value) {
        if (parseInt(_this.dom.find(".dial").val()) != value)
        {
            _this.dial.val(Math.floor(value));
            _this.dial.trigger('change');
        }
    }
    _this.replaceDial = function(readOnly, newValue) {
        var _this = this;
        
        _this.dial = $("#base-dial").clone();
        _this.dial.removeAttr('id');

        _this.dial.attr('data-max', dial_max_value);

        var dialContainer = _this.dom.find(".dial-container");
        dialContainer.html('');
        dialContainer.append(_this.dial);

        _this.dial.knob({'fgColor' : '#26ADE4', 'width' : 120, 'readOnly' : readOnly, 'readOnlyStart' : newValue});
        _this.setDialValue(newValue);
    };

    _this.freeze = function() {
        var _this = this;
        _this.codemirror.setOption('readOnly', true);
        _this.dialValue = _this.dom.find(".dial").attr('value');
        _this.replaceDial(true, _this.dialValue);

    };
    _this.unfreeze = function() {
        var _this = this;
        _this.codemirror.setOption('readOnly', false);
        _this.replaceDial(false, _this.dialValue);
    };

    _this.initialize();
}

function clearQueryWidgets() {
    for (var i in query_widget_map)
    {
        query_widget_map[i].delete();
    }
    global_query_id = 0;
}

function freezeAllQueryWidgets() {
    for (var i in query_widget_map) {
        query_widget_map[i].freeze();
    }
    $(".CodeMirror").css('background-color', '#fbfbfb');
}
function unfreezeAllQueryWidgets() {
    for (var i in query_widget_map) {
        query_widget_map[i].unfreeze();
    }

    $(".CodeMirror").css('background-color', '#fff');
}

function adjustWidgetMargins() {
    container_width = $(".widget-container").innerWidth();
    widget_width = $(".widget").outerWidth();
    free_space = container_width % widget_width;
    widgets_per_row = Math.floor(container_width / widget_width);

    $(".widget").each(function(index, value) {
        if (index % widgets_per_row != widgets_per_row - 1)
        {
            $(this).css('margin-right', free_space/widgets_per_row);
        }
        else
        {
            $(this).css('margin-right', 0);
        }
        $(this).css('margin-bottom', Math.min(free_space/widgets_per_row, 40));
    });
}


$(window).resize(function() {
    adjustWidgetMargins();
});
