// ---------------------------------------
// Tools for setting and getting workload.
// 
function getWorkload() 
{
    var ret = {}
    for (var i in query_widget_map) {
        if (!query_widget_map[i].codemirror) {
            continue;
        }
        query = query_widget_map[i].codemirror.getValue();
        qps   = query_widget_map[i].dial.attr('value');
    
        if (query == '') {
            continue;
        }

        ret[i] = {
            'query' : query,
            'qps'  :  qps
        };
    }
    return ret;
}

function cacheWorkload()
{
    var all = {}
    for (var i in query_widget_map) {
        if (!query_widget_map[i].codemirror) {
            continue;
        }
        query = query_widget_map[i].codemirror.getValue();
        qps   = query_widget_map[i].dial.attr('value');

        all[i] = {
            'query' : query,
            'qps'  :  qps
        };
    }

    workload_s = JSON.stringify(all);
    localStorage.setItem('workload_cache', workload_s);
}

function loadWorkload(workload) {
    max_index = 0;
    clearQueryWidgets();
    for (var i in workload)
    {
        max_index = Math.max(i, max_index);
    }
    for (var i = 0; i <= max_index; i++)
    {
        if (workload[i] != null)
        {
            q = new QueryWidget();
            q.codemirror.setValue(workload[i]['query']);
            q.dialValue = workload[i]['qps'];
            q.unfreeze();
        }
    }
}

// ---------------------------------------
// Tools for setting and getting settings.
//
function updateSettings() {
    g_settings = {};
    $("#settings-form").find("input").each(function(i, e) {
        var _e = $(e);
        g_settings[_e.attr('id')] = _e.val();
    });
    g_settings['dial_max_value'] = dial_max_value;
}

function getSettings() {
    if (!g_settings) {
        updateSettings();
    }
    return g_settings;
}

function cacheSettings()
{
    if (livemode) {
        cache_name = 'settings_cache_live';
    } else {
        cache_name = 'settings_cache';
    }
    settings = JSON.stringify(getSettings());
    curr = localStorage.getItem(cache_name);
    localStorage.setItem(cache_name, settings);
}

function loadCachedSettings()
{
    if (livemode) {
        cache_name = 'settings_cache_live';
    } else {
        cache_name = 'settings_cache';
    }
    var settings_s = localStorage.getItem(cache_name);
    if (settings_s) {
        loadSettings(JSON.parse(settings_s));
    }
}

function loadSettings(settings)
{
    dial_max_value = settings['dial_max_value'];
    reloadDialMaxValue();

    for (var s in settings)
    {
        e = $("#" + s);
        if (e)
        {
            e.val(settings[s]);
        }
    }
    updateSettings();
}

function reloadDialMaxValue()
{
    $("#qps-number").attr('value', dial_max_value);
    console.log(dial_max_value);

    for (var i in query_widget_map)
    {
        var widget = query_widget_map[i];
        var val = widget.dial.attr('value')
        widget.replaceDial(false, val);
    }
}

var dialValueEnabled = true;
function updateDialValue(plus)
{
    if (!dialValueEnabled)
    {
        return;
    }

    dial_max_value += 5000 - 1;
    dial_max_value -= (dial_max_value % 5000);

    if (plus) {
        dial_max_value += 5000;
    } else {
        dial_max_value -= 5000;
    }

    if (dial_max_value == 0) {
        dial_max_value = 1;
    }

    reloadDialMaxValue();
}

function setMaxDialValue(v)
{
    var vInt = parseInt(v);
    if (vInt == NaN)
    {
        createError({errno: ER_JS, message: "Invalid integer " + v});
        return;
    }

    dial_max_value = vInt;
    reloadDialMaxValue();
}

function activateDialValue()
{
    dialValueEnabled = true;

    $("#dial-up").unbind('click');
    $("#dial-down").unbind('click');

    $("#dial-up").click(function()   {  updateDialValue(true);  })
    $("#dial-down").click(function() {  updateDialValue(false); })

    $("#dial-up").removeClass("disabled");
    $("#dial-down").removeClass("disabled");
}

function deactivateDialValue()
{
    dialValueEnabled = false;
    $("#dial-up").unbind('click');
    $("#dial-down").unbind('click');

    $("#dial-up").addClass("disabled");
    $("#dial-down").addClass("disabled");
}

function displaySettings()
{
    $("#settings-form").show();
    $("#settings-button").addClass('active');
}
function hideSettings()
{
    $("#settings-form").hide();
    $("#settings-button").removeClass('active');
}

var pingingStopped = false;

function pingServer() {
    if (!pingingStopped) {
        $.ajax({
            'type'     : 'POST',
            'url'      : '/ping',
            'dataType' : 'text',
            'data'     : null,
            'success'  : onPingResponse,
            'error'    : onPingResponse
        });
    }
}

function onPingResponse(data, textStatus, jqXHR) {
    if (data != 'OK') {
        onPingFailure();
    }
}

function onPingFailure() {
    pingingStopped = true;
    $("#refresh-modal").modal({keyboard : false, backdrop : 'static', show: true});
}

function byeServer() {
    if (!pingingStopped) {
        $.ajax({
            'type'     : 'PUT',
            'url'      : '/unload',
            'async'    : false,
            'dataType' : 'text',
            'data'     : null,
            'success'  : null,
            'error'    : null 
        });
    }
    pingingStopped = true;
}

// -------------------------
// Tools for error handling.
// 
function genericError(jqXHR, textStatus, errorThrown)
{
    alert("something went wrong...");
    console.log(jqXHR);
    console.log(textStatus);
    console.log(errorThrown);
    console.trace();
}

var ER_UNKNOWN  = 0
var ER_DBCONN   = 1
var ER_DBNAME   = 2
var ER_JS       = 3
var ER_QUERY    = 4
var ER_SETTINGS = 5

function errno_to_hint(errno)
{
    if (errno == ER_UNKNOWN)
    {
        return "Internal Error";
    }
    else if (errno == ER_DBCONN)
    {
        return null;
    }
    else if (errno == ER_DBNAME)
    {
        return null;
    }
    else if (errno == ER_JS)
    {
        return null;
    }
    else if (errno == ER_QUERY)
    {
        return null;
    }
    else if (errno == ER_SETTINGS)
    {
        return null;
    }
    else
    {
        return "Unknown Error";
    }
}

function createError(err)
{
    var dom = $("#empty-error").clone();
    dom.removeAttr('id');
    dom.css('display', 'none');
    
    var message = err.message;
    var hint = errno_to_hint(err.errno);
    if (hint)
    {
        message = "[" + hint + "] " + message
    }

    dom.find('.error-message').html(message);
    dom.css('display', 'block');

    $("#notifications").append(dom);

    if (err.errno == ER_DBCONN)
    {
        displaySettings();
        $("#memsql_host").focus();
    }
    else if (err.errno == ER_DBNAME || err.errno == ER_SETTINGS)
    {
        displaySettings();
        $("#memsql_db").focus();
    }
    else if (err.errno == ER_JS)
    {
        dom.removeClass('alert-error');
    }
    else if (err.errno == ER_QUERY)
    {
        for (var query_id in err.query_map)
        {
            query_widget_map[query_id].highlight_error(err.query_map[query_id]);
        }
    }
    
    setTimeout(function() { dom.fadeOut('slow'); }, 10000);
}

function freezeSettingsForm() {
    $("#settings-form").find("input").attr('readonly', 'readonly');
}

function unfreezeSettingsForm() {
    $("#settings-form").find("input").removeAttr('readonly');
}

function setLoadingStatus(message)
{
    var e = $("#loading-message");
    e.find('.message').html(message);
    e.show();
}

function isLoadingStatusActive()
{
    return $("#loading-message").css('display') != 'none';
}

function clearLoadingStatus()
{
    $("#loading-message").fadeOut(1000);
}

function autoSave(f)
{
    setInterval(f, 1000);
    $(window).click(f);
}

// --------------
// Console setup.
//
if(typeof(String.prototype.trim) === "undefined")
{
    String.prototype.trim = function() 
    {
        return String(this).replace(/^\s+|\s+$/g, '');
    };
}

String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) { 
        return typeof args[number] != 'undefined'
            ? args[number]
            : match
        ;
    });
};

function sendSqlCommand(command)
{
    $.ajax({
        'type' : 'GET',
        'url'  : '/sql',
        'dataType' : 'json',
        'data'  : {
            'command' : command,
            'settings' : JSON.stringify(getSettings())
        },
        'success' : onSqlOutput,
        'error' : genericError
    });
}

function onSqlOutput(data, textStatus, jqXHR)
{
    jqconsole.Write(data.output + "\n", 'jqconsole-output');
    if (data.db)
    {
        $("#memsql_db").val(data.db);
        cacheSettings();
    }
    startPrompt();
}

// In case we can't get the actual version.
// Should be MemSQL but that could hide bugs so I'm leaving it like this for now.
var whatSql = 'NoSQL';

function getWhatSql() {
    $.ajax({
        'type'     : 'GET',
        'url'      : '/sql',
        'dataType' : 'json',
        'data'     : {
            'command'  : 'show variables;',
            'settings' : JSON.stringify(getSettings())
        },
        'success'  : onWhatSqlSuccess,
        'error'    : onWhatSqlFailure
    });
}

var consoleWelcomeFormatString = "\
Welcome to {0}! you can use this \
console to run commands against the database.\n\n";

function onWhatSqlSuccess(data, textStatus, jqXHR) {
    if (data['error']) {
        createError(data['error']);
        onWhatSqlFailure();
    } else {
        oldWhatSql = whatSql;
        if (data.output.indexOf('MemSQL') != -1) {
            whatSql = 'MemSQL';
        } else {
            whatSql = 'MySQL';
        }
        if (!jqconsole) {
            continueInitConsole();
        } else if (whatSql != oldWhatSql) {
            resetConsole();
        }
    }
}

function onWhatSqlFailure(jqXHR, textStatus, errorThrown) {
    if (!jqconsole) {
        continueInitConsole();
    }
}

function startPrompt()
{
    function checkEOI(input)
    {
        trimmed = input.trim();
        if (trimmed.length > 0 && trimmed[trimmed.length-1] == ';')
        {
            return false;
        }
        return 0;
    }

    // Start the prompt with history enabled.
    jqconsole.Prompt(true, sendSqlCommand, checkEOI);
}

var jqconsole = null;
function initializeConsole()
{
    getWhatSql();
}

function continueInitConsole() {
    jqconsole = $("#console").jqconsole(consoleWelcomeFormatString.format(whatSql), whatSql.toLowerCase() + "> ", "     -> ");
    $("#console").find(".jqconsole").attr('id', 'inner-memsql-console');
    startPrompt();
    jqconsole.Focus();
}

function resetConsole() {
    jqconsole.prompt_label_main = whatSql.toLowerCase() + "> ";
    jqconsole.Write(consoleWelcomeFormatString.format(whatSql));
    startPrompt();
    jqconsole.ClearPromptText();
}

// -------------------
// General page setup.
// 

$(document).ready(function() {
    qps_graph = new QueryGraph("Queries Per Second");

    reloadDialMaxValue();

    activateDialValue();

    $(window).bind('settingsUpdated', function() {
        updateSettings();
        getWhatSql();
    });

    $("#settings-button, #settings-form-close").click(function() {
        if ($("#settings-form").css("display") == "none")
        {
            displaySettings();
        }
        else
        {
            hideSettings();
            jqconsole.Focus();
            $(window).trigger('settingsUpdated');
        }
    });

    $("[rel=popover]").popover({'placement' : 'right'});
    $("[rel=tooltip]").tooltip({'placement' : 'right'});

    $("#qps-number").change(function() { setMaxDialValue($("#qps-number").val()); });

    loadCachedSettings();
    autoSave(cacheSettings);

    initializeConsole();
});
