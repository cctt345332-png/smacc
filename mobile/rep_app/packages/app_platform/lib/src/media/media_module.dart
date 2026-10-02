import 'package:image_picker/image_picker.dart';
import 'package:injectable/injectable.dart';

@module
abstract class MediaModule {
  @lazySingleton
  ImagePicker get imagePicker => ImagePicker();
}
