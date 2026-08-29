//
//  App-Bridging-Header.h
//  PHASE: Rugby Manager
//
//  WHY THIS FILE EXISTS.
//
//  PhaseBilling.m is Objective-C in an otherwise pure-Swift target, and it
//  imports <Capacitor/Capacitor.h> to get the CAP_PLUGIN macro. An ObjC file
//  in a Swift target only compiles when the target has a bridging header, and
//  the Capacitor 8 iOS template does NOT generate one - verified against a
//  real `npx cap add ios` scaffold, which produces AppDelegate.swift and
//  SceneDelegate.swift and no header of any kind.
//
//  Xcode OFFERS to create a bridging header the first time you drag an ObjC
//  file into a Swift target. Accept that offer and you get an empty one and
//  still have to add this import. Decline it - or add the files any other way
//  - and PhaseBilling.m fails to compile with "'Capacitor/Capacitor.h' file
//  not found", which reads like a broken dependency and is not one.
//
//  So the header ships here, alongside the plugin it serves. scaffold.sh
//  copies it in with the rest; README.md §5 has the one build setting that
//  points Xcode at it.
//
#import <Capacitor/Capacitor.h>
