class InvoiceTemplates {
  static String generateInvoiceFromTemplate({
    required String template,
    required Map<String, dynamic> data,
  }) {
    String html = template;

    // 1. Process Conditionals ({{#if key}}...{{/if}})
    final ifRegex = RegExp(r'\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}');
    html = html.replaceAllMapped(ifRegex, (match) {
      final key = match.group(1);
      final content = match.group(2);
      final value = data[key];
      if (value != null && value != false && value.toString().isNotEmpty && value != 0) {
        return content!;
      }
      return '';
    });

    // 2. Process Loops ({{#each items}}...{{/each}})
    final eachRegex = RegExp(r'\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}');
    html = html.replaceAllMapped(eachRegex, (match) {
      final key = match.group(1);
      final rowTemplate = match.group(2)!;
      final List list = data[key] as List? ?? [];
      
      return list.map((item) {
        String row = rowTemplate;
        (item as Map<String, dynamic>).forEach((k, v) {
          row = row.replaceAll('{{$k}}', v.toString());
        });
        return row;
      }).join('');
    });

    // 3. Simple Placeholders
    data.forEach((k, v) {
      if (v is! List) {
        html = html.replaceAll('{{$k}}', v?.toString() ?? '');
      }
    });

    return html;
  }
}
