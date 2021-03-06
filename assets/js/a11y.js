var tts_url = "https://tts.deyan.us";
$.ajax({
  type: "HEAD",
  async: true,
  url: tts_url,
}).done(function (message, text, jqXHR) {
  console.log("tts.deyan.us is up, GPU tts is available.");
}).fail(function () {
  tts_url = "https://corpora.mathweb.org";
  console.log("tts.deyan.us is down, falling back to CPU tts (slower).");
});
// call mozilla/TTS with the content of the preceding span.speech
function ttsSpeak(btn) {
  let speech = $(btn).nextAll("span.speech:first").text().trim();
  if (!speech.endsWith('.')) { speech += '.'; }
  $("body").css("cursor", "progress");
  fetch(tts_url+'/api/tts?text=' + encodeURIComponent(speech), {})
    .then(function (res) {
      if (!res.ok) {
        alert("Server generating mozilla/TTS speech may be offline, as it is hosted on a personal machine. Please ask admin to enable.");
        return false; }
      else {
        return res.blob(); }
    }).then(function (blob) {
      let audio = $('<audio controls autoplay />');
      audio.insertAfter($(btn).nextAll("br:first"));
      audio.attr("src", window.URL.createObjectURL(blob));
      $(btn).attr('onClick', 'return false;');
      $("body").css("cursor", "auto");
    }).catch(function (err) {
      alert("Server generating mozilla/TTS speech may be offline, as it is hosted on a personal machine. Please ask admin to enable.");
      $("body").css("cursor", "auto");
    });
  return;
}

// some HTML boilerplate...
let speak_btn = "<span class='btn-speak' onClick='ttsSpeak(this); return false'>🔊</span>";
let sre_pre = "<span class='bold'><a href='https://github.com/zorkow/speech-rule-engine'>SRE</a>:&nbsp;</span>";

var latexml_a11y_url = "https://latexml.mathweb.org/a11y/convert";
//var latexml_a11y_url = "http://localhost:3000/convert";
var latexml_preloads_base = ["LaTeX.pool", "article.cls", "amsmath.sty", "amsthm.sty", "amstext.sty", "amssymb.sty", 'array.sty']
var latexml_settings_base = { // minimal latexml preloads for somewhat usual latex math
    "timeout": "10", "format": "html5", "whatsin": "fragment",
    "whatsout": "math", "pmml": "",
    "postamble": "literal:\n\\end{document}" }
const leading_newline = /^\n+/;
// convert a chosen 'tex' input to MathML+annotations via latexml
function handle_input(tex) {
  $("body").css("cursor", "progress");
  let log_container = $("div.latexml-log");
  log_container.hide();
  log_container.html('');
  let preloads_current = latexml_preloads_base.slice(0);
  let latexml_settings = { ...latexml_settings_base };
  let a11y_mode = $('#a11y-mode').val();
  switch (a11y_mode) {
    case 'a11y': {
      preloads_current.push("[mark]a11ymark.sty");
      break; }
    case 'cmml': {
      latexml_settings["cmml"] = ""; }
    default: {
      preloads_current.push("[nomark]a11ymark.sty");
    } }
  latexml_settings["cache_key"] = "a11y_showcase_"+a11y_mode;
  if (tex.startsWith("\\begin")) {
    latexml_settings["tex"] = tex; }
  else {
    latexml_settings["tex"] = '\\(' + tex + '\\)'; }
  latexml_settings["preload"] = preloads_current;
  latexml_settings["preamble"] = "literal:" + $("#preamble").val() + "\n\\begin{document}\n";

  $.post(latexml_a11y_url, latexml_settings, function (data) {
    $('thead').css('visibility','visible');
    if (data.status_code == 3) {
      log_container.html("<span>"+data.log.trim().replaceAll("\n","<br>")+"</span>");
      log_container.show();
      return; }
    let mathml = $(data.result);
    mathml.removeAttr('alttext'); // table is too wide if kept

    let narration_phrase = narrate(mathml, 'phrase');
    let narration_sentence = narrate(mathml, 'sentence');
    let annotation_tree = narrate(mathml, 'annotation');
    let sre_narration = SRE.toSpeech(mathml[0].outerHTML);
    let narration_html = sre_pre + "<br>" + speak_btn+"<span class='speech'>" + sre_narration + "</span>" + "<br><br>";
    if (narration_phrase == narration_sentence) {
      narration_html += "<span class='bold'>semantic:&nbsp;</span><br>" + speak_btn +
        "<span class='speech'>"+narration_phrase+"</span>"; }
    else {
      narration_html +=
        "<span class='bold'>semantic brief:&nbsp;</span><br>" + speak_btn +
        "<span class='speech'>" + narration_phrase + "</span>" + "<br><br>"+
        "<span class='bold'>semantic full:&nbsp;</span><br>" + speak_btn +
        "<span class='speech'>" + narration_sentence +"</span>"; }
    narration_html += "<br><br><span class='bold'>annotation:&nbsp;</span>" + annotation_tree +
      "<br><br>" + $("span#raw-tex").html() +'<span class="remove-tr">🗑</span>';
    // we won't need to render the data-arg-path attributes, and any other runtime attributes we end up with.
    mathml.find("[data-arg-path]").each(function (idx,el) {
      el.removeAttribute('data-arg-path'); });
    let pretty = $('<code/>', { 'class': "xml" });
    pretty.text(mathml.html().replace(leading_newline, ''));
    $("table:not([class]):first tbody tr:last").before(
      '<tr><td class="w30 xlarge">' + mathml[0].outerHTML +
      "</td><td class='w35'>" + '<pre>' + pretty[0].outerHTML + "</pre></td><td class='w35 narration'>" +
      narration_html + '</td></tr>');

    let code_tr = $("table:not([class]):first tbody tr:last").prev();
    block = $(code_tr).find("pre code");
    hljs.highlightBlock(block[0]);
    if (a11y_mode == 'cmml') {
      retouch_hljs_for_cmml(); }
    if (typeof MathJax != "undefined") { // retypeset doc if we have MathJax loaded
      MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
    }
    $('tbody tr:not(:last)').hover(function () {
      $(this).find('span.remove-tr').css('display','inline-block');
    }, function () {
      $(this).find('span.remove-tr').css('display', 'none');
    });
    $('table:not([class])').on('click', 'span.remove-tr', function () {
      $(this).closest('tr').remove();
    });
    $("html, body").animate({ scrollTop: $(document).height() }, "slow");
  }, "json")
    .fail(function () {
      alert("failed to convert.");
    })
    .always(function() {
      $("body").css("cursor", "auto");
    });
}

// quick auxiliary for escaping the tex source strings...
function dirty_escape_html(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;"); }

// set up the UI bits, dashboard, form events...
$(document).ready(function () {
  example_gallery.sort(function (a, b) {
    return a.value.toLowerCase() > b.value.toLowerCase();
  });
  $(example_gallery).each(function (index, example) {
    example.data.index = index;
  });
  let options = '<option disabled selected value> select example </option>';
  $.each(example_gallery, function (index,example) {
    options += '<option value=' + example.data.index + '>' + example.value + '</option>';
  });
  let autocomplete_element = '<input type="text" name="auto-example" placeholder="Search examples" id="autocomplete-example"/>';
  let select_element = '<select id="example_select" name="example">'+options+'</select>';
  $("table:not([class]):first tbody tr:last").replaceWith('<tr class="choice"><td class="w30">Examples</td><td class="w35">' + autocomplete_element + '<span>&nbsp;</span>' + select_element +
    '<input type="submit" id="reset_table" value="clear all"></td><td><span id="raw-tex"></span>'+'</td></tr>');

  $("#example_select").change(function() {
    // convert and grab MathML
    let this_val = parseInt($(this).val());
    let tex = example_gallery[this_val].data.tex;
    let escaped_tex = dirty_escape_html(tex);
    $("span#raw-tex").html("<span class='tex-source'><span class='bold'>tex: </span>" +dirty_escape_html(tex)+'</span>');
    handle_input(tex);
  });

  // augment the example_gallery with additional entries for autocompleting on the latex syntax
  expanded_gallery = [];
  $(example_gallery).each(function(index,example) {
    expanded_gallery.push({value: example.value+'  ('+example.data.category+')', data: example.data });
    expanded_gallery.push({value: example.data.tex, data: example.data});
  });

  $('#autocomplete-example').autocomplete({
    lookup: expanded_gallery,
    lookupLimit: 14,
    lookupFilter: function (suggestion, query, queryLowerCase) {
      if (query.indexOf('\\') == -1) {
        if (suggestion.value.indexOf('\\') == -1) {
          let re = new RegExp('\\b' + $.Autocomplete.utils.escapeRegExChars(queryLowerCase), 'gi');
          return (re.test(suggestion.value)); }
        else { return false; } }
      else {
        if (suggestion.value.indexOf('\\') > -1) {
          let re = new RegExp($.Autocomplete.utils.escapeRegExChars(query), 'gi');
          return (re.test(suggestion.value)); }
        else { return false; } } },
    preserveInput: false,
    showNoSuggestionNotice: true,
    onSelect: function (suggestion) {
      let option = $('#example_select').find("option[value="+suggestion.data.index+"]").first();
      if (!option.prop('selected')) { // avoid double-toggle
        option.prop('selected', 'selected').change(); }
    }
  });

  $("form").submit(function (e) {
    e.preventDefault();
    $("span#raw-tex").html("<span class='tex-source'><span class='bold'>tex: </span>" + dirty_escape_html($("input#freetex").val())+'</span>');
    handle_input($("input#freetex").val());
    return false;
  });

  // cleanup UI
  $("input#reset_table").click(function (e) {
    e.preventDefault();
    $("table:not([class]):first tbody tr:not(:last)").remove();
  });

  // allow tweaking spec languge
  $("form#spec-explorer :text").change(function () {
    // always start from the original LaTeXML mathml, and regenerate all 3 variants
    // of the accessibility spec, to stay consistent.
    let main_attr_target = $("input#a11y-main-attribute").data('default');
    let secondary_attr_target = $("input#a11y-secondary-attribute").data('default');
    let sigil_target = $("input#a11y-arg-sigil").data('default');
    let new_main_attr_name = $("input#a11y-main-attribute").val();
    let new_scnd_attr_name = $("input#a11y-secondary-attribute").val();
    let new_sigil_val = $("input#a11y-arg-sigil").val();

    $('code.hljs').each(function (index, this_code) {
      let mathml = $(this_code).closest('td').prev().find('math:first').clone();
      if (main_attr_target != new_main_attr_name || (sigil_target != new_sigil_val)) {
        mathml.find('*[' + main_attr_target + ']').each(function(index, node) {
          let attr_val = $(node).attr(main_attr_target);
          if (sigil_target != new_sigil_val) {
            attr_val = attr_val.replaceAll(sigil_target, new_sigil_val);
          }
          $(node).attr(new_main_attr_name, attr_val);
          if (main_attr_target != new_main_attr_name) {
            $(node).removeAttr(main_attr_target);
          }
        });
      }
      if (secondary_attr_target != new_scnd_attr_name) {
        mathml.find('*[' + secondary_attr_target + ']').each(function (index, node) {
          $(node).attr(new_scnd_attr_name, $(node).attr(secondary_attr_target))
            .removeAttr(secondary_attr_target);
        });
      }
      let new_hljs = $('<code/>', { 'class': "xml" });
      new_hljs.text(mathml.html().replace(leading_newline, ''));
      $(this_code).removeAttr('hljs');
      let this_pre = $(this_code).parent();
      $(this_code).remove();
      this_pre.append(new_hljs);
      let replaced = this_pre.children('code').first();
      hljs.highlightBlock(replaced[0]);
      replaced.addClass('hljs');
    });
  });

});

function tweak_spec() {
  $('form#spec-explorer').toggle();
}