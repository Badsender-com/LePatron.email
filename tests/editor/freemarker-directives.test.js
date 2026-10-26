'use strict';

/* eslint-disable no-template-curly-in-string -- FreeMarker variables, not JS templates */

const {
  restoreFreemarkerDirectives,
} = require('../../packages/editor/src/js/ext/freemarker-directives.js');

// The input of each case is what the export frame serializes when a user types
// the directive in a text field: a text node, so `&`, `<`, `>` and the
// non-breaking space come out as entities, and nothing else does.
describe('restoreFreemarkerDirectives', () => {
  it('restores a condition typed in a text field', () => {
    const exported =
      '<p>&lt;#if ( datas.OFFER != "GIFT")&gt; Welcome ' +
      '${user.firstname} ! &lt;#else&gt; ${ giver.firstname } ' +
      'gave you a subscription&lt;/#if&gt;</p>';

    expect(restoreFreemarkerDirectives(exported)).toBe(
      '<p><#if ( datas.OFFER != "GIFT")> Welcome ' +
        '${user.firstname} ! <#else> ${ giver.firstname } ' +
        'gave you a subscription</#if></p>'
    );
  });

  it('restores every directive, not only if and else', () => {
    expect(
      restoreFreemarkerDirectives(
        '&lt;#assign n = 1&gt;&lt;#if n == 1&gt;a&lt;#elseif n == 2&gt;b&lt;/#if&gt;'
      )
    ).toBe('<#assign n = 1><#if n == 1>a<#elseif n == 2>b</#if>');
  });

  it('restores a directive split across paragraphs', () => {
    expect(
      restoreFreemarkerDirectives(
        '<p>&lt;#if premium&gt;</p>\n<p>VIP</p>\n<p>&lt;/#if&gt;</p>'
      )
    ).toBe('<p><#if premium></p>\n<p>VIP</p>\n<p></#if></p>');
  });

  it('decodes the operators inside the directive', () => {
    expect(
      restoreFreemarkerDirectives(
        '&lt;#if a &amp;&amp; (b &gt; 2)&gt;x&lt;/#if&gt;'
      )
    ).toBe('<#if a && (b > 2)>x</#if>');
  });

  it('ends the directive at the first `>` outside a string', () => {
    expect(
      restoreFreemarkerDirectives('&lt;#if x == "a&gt;b"&gt;y&lt;/#if&gt;')
    ).toBe('<#if x == "a>b">y</#if>');
  });

  it('restores a comment up to its own end, apostrophes included', () => {
    expect(
      restoreFreemarkerDirectives("&lt;#-- l'offre &gt; 2 mois --&gt;x")
    ).toBe("<#-- l'offre > 2 mois -->x");
  });

  // TinyMCE turns repeated spaces into non-breaking ones, which FreeMarker does
  // not read as whitespace.
  it('turns a non-breaking space inside the directive into a space', () => {
    expect(restoreFreemarkerDirectives('&lt;#if&nbsp; a&gt;&nbsp;b')).toBe(
      '<#if  a>&nbsp;b'
    );
  });

  it('leaves the text between directives escaped', () => {
    expect(
      restoreFreemarkerDirectives(
        '&lt;#if a&gt;x &amp;lt; y &lt;b&gt;&lt;/#if&gt;'
      )
    ).toBe('<#if a>x &amp;lt; y &lt;b&gt;</#if>');
  });

  // A `<` restored inside a directive could open a real element in the export:
  // the directive stays escaped, and FreeMarker's `lt` does the comparison.
  it('leaves a directive holding a `<` escaped', () => {
    const exported = '&lt;#if (a &lt; b)&gt;x&lt;/#if&gt;';

    expect(restoreFreemarkerDirectives(exported)).toBe(
      '&lt;#if (a &lt; b)&gt;x</#if>'
    );
  });

  it('leaves a directive cut by markup escaped', () => {
    const exported = '&lt;#if <strong>a</strong>&gt;';

    expect(restoreFreemarkerDirectives(exported)).toBe(exported);
  });

  it('leaves a directive that never closes escaped', () => {
    expect(restoreFreemarkerDirectives('&lt;#if a')).toBe('&lt;#if a');
    expect(restoreFreemarkerDirectives('&lt;#if "a&gt;')).toBe(
      '&lt;#if "a&gt;'
    );
  });

  it('leaves text that only looks like a directive alone', () => {
    const text = '<p>&lt;# 1 &lt;#&gt; C&lt;#&gt; &lt;/ #if&gt;</p>';

    expect(restoreFreemarkerDirectives(text)).toBe(text);
  });

  it('leaves real markup and the other ESP tags alone', () => {
    const html =
      '<td class="a">${user.name} {{firstname}} %%prenom%% <%= x %></td>';

    expect(restoreFreemarkerDirectives(html)).toBe(html);
  });
});
