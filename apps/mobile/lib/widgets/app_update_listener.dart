import 'package:flutter/material.dart';
import 'package:upgrader/upgrader.dart';

class AppUpdateListener extends StatelessWidget {
  final Widget child;
  const AppUpdateListener({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    // We wrap the child with UpgradeAlert which checks the App Store / Play Store automatically.
    return UpgradeAlert(
      dialogStyle: UpgradeDialogStyle.cupertino,
      upgrader: Upgrader(
        durationUntilAlertAgain: const Duration(days: 1),
      ),
      child: child,
    );
  }
}
