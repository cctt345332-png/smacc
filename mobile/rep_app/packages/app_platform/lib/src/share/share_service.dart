import 'package:injectable/injectable.dart';
import 'package:share_plus/share_plus.dart';

@lazySingleton
class ShareService {
  ShareService(this._share);

  final SharePlus _share;

  Future<void> share({required String text, String? subject}) {
    return _share.share(ShareParams(text: text, subject: subject));
  }

  Future<void> shareFiles({
    required List<String> paths,
    String? subject,
    String? text,
  }) {
    return _share.share(
      ShareParams(
        files: paths.map(XFile.new).toList(),
        subject: subject,
        text: text,
      ),
    );
  }
}
