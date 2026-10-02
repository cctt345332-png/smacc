import 'package:injectable/injectable.dart';
import 'package:share_plus/share_plus.dart';

@module
abstract class ShareModule {
  @lazySingleton
  SharePlus provideSharePlus() => SharePlus.instance;
}
