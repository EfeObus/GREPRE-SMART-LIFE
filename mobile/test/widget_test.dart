// Basic Flutter widget test for SmartLife app

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:grepre_smartlife/main.dart';

void main() {
  testWidgets('App smoke test - loads without errors', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(
      const ProviderScope(
        child: GrePreSmartLifeApp(),
      ),
    );

    // Just verify the app loads without throwing
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
