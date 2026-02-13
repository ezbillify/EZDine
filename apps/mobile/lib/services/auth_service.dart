import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final authServiceProvider = Provider((ref) => AuthService());

class AuthService {
  final _client = Supabase.instance.client;

  User? get currentUser => _client.auth.currentUser;
  Stream<AuthState> get authStateChanges => _client.auth.onAuthStateChange;

  Future<void> signInWithOtp(String email) async {
    await _client.auth.signInWithOtp(email: email);
  }

  Future<void> verifyOtp(String email, String token) async {
    await _client.auth.verifyOTP(
      email: email,
      token: token,
      type: OtpType.email,
    );
  }

  Future<void> signOut() async {
    await _client.auth.signOut();
  }

  Future<Map<String, dynamic>?> getUserProfile() async {
    if (currentUser == null) return null;
    final response = await _client
        .from('user_profiles')
        .select()
        .eq('id', currentUser!.id)
        .maybeSingle();
    return response;
  }
  
  Future<String?> getActiveRole() async {
    if (currentUser == null) return null;

    final restaurantRes = await _client
        .from('user_restaurants')
        .select('role')
        .eq('user_id', currentUser!.id)
        .maybeSingle();

    if (restaurantRes != null) {
      return restaurantRes['role'];
    }

    final profile = await getUserProfile();
    if (profile != null && profile['active_branch_id'] != null) {
      final branchRes = await _client
          .from('user_branches')
          .select('role')
          .eq('user_id', currentUser!.id)
          .eq('branch_id', profile['active_branch_id'])
          .maybeSingle();
      
      if (branchRes != null) {
        return branchRes['role'];
      }
    }

    final anyBranchRes = await _client
        .from('user_branches')
        .select('role')
        .eq('user_id', currentUser!.id)
        .limit(1)
        .maybeSingle();

    return anyBranchRes?['role'];
  }

  Future<List<Map<String, dynamic>>> getMyRestaurants() async {
    if (currentUser == null) return [];
    final response = await _client
        .from('user_restaurants')
        .select('restaurants(id, name)')
        .eq('user_id', currentUser!.id);
    
    return (response as List).map((e) => e['restaurants'] as Map<String, dynamic>).toList();
  }

  Future<List<Map<String, dynamic>>> getBranches(String restaurantId) async {
    final response = await _client
        .from('branches')
        .select()
        .eq('restaurant_id', restaurantId);
    
    return List<Map<String, dynamic>>.from(response);
  }

  Future<void> updateActiveBranch(String branchId) async {
    if (currentUser == null) return;
    await _client
        .from('user_profiles')
        .update({'active_branch_id': branchId})
        .eq('id', currentUser!.id);
  }

  Future<String?> getActiveRoleForBranch(String restaurantId, String branchId) async {
     if (currentUser == null) return null;
     final res = await _client
        .from('user_branches')
        .select('role')
        .eq('user_id', currentUser!.id)
        .eq('branch_id', branchId)
        .maybeSingle();
      return res?['role'];
  }

  Future<bool> isOwnerOf(String restaurantId) async {
     if (currentUser == null) return false;
     final res = await _client
        .from('user_restaurants')
        .select('role')
        .eq('user_id', currentUser!.id)
        .eq('restaurant_id', restaurantId)
        .eq('role', 'owner')
        .maybeSingle();
      return res != null;
  }

  Future<List<Map<String, dynamic>>> getAccessibleBranches(String restaurantId) async {
    final branches = await getBranches(restaurantId);
    
    // Check ownership
    final isOwner = await isOwnerOf(restaurantId);
    if (isOwner) return branches;

    // Filter for assigned branches
    final accessible = <Map<String, dynamic>>[];
    for (var b in branches) {
       // Check if user has a row in user_branches for this branch
       final role = await getActiveRoleForBranch(restaurantId, b['id']);
       if (role != null) {
         accessible.add(b);
       }
    }
    return accessible;
  }
}

final authStateProvider = StreamProvider<AuthState>((ref) {
  return ref.watch(authServiceProvider).authStateChanges;
});

// Providers to manage state across navigation
final userProfileProvider = FutureProvider<Map<String, dynamic>?>((ref) async {
  return ref.watch(authServiceProvider).getUserProfile();
});

final userRoleProvider = FutureProvider<String?>((ref) async {
  return ref.watch(authServiceProvider).getActiveRole();
});

class ContextState {
  final String? restaurantId;
  final String? restaurantName;
  final String? branchId;
  final String? branchName;
  final bool isLoading;

  ContextState({
    this.restaurantId,
    this.restaurantName,
    this.branchId,
    this.branchName,
    this.isLoading = false,
  });

  ContextState copyWith({
    String? restaurantId,
    String? restaurantName,
    String? branchId,
    String? branchName,
    bool? isLoading,
  }) => ContextState(
    restaurantId: restaurantId ?? this.restaurantId,
    restaurantName: restaurantName ?? this.restaurantName,
    branchId: branchId ?? this.branchId,
    branchName: branchName ?? this.branchName,
    isLoading: isLoading ?? this.isLoading,
  );
}

class ContextNotifier extends StateNotifier<ContextState> {
  final AuthService _auth;
  ContextNotifier(this._auth) : super(ContextState(isLoading: true)) {
    init();
  }

  Future<void> init() async {
    state = state.copyWith(isLoading: true);
    final profile = await _auth.getUserProfile();
    final restaurants = await _auth.getMyRestaurants();
    
    if (restaurants.isNotEmpty) {
      final activeRest = restaurants.first;
      
      // Use the new consolidated logic
      final validBranches = await _auth.getAccessibleBranches(activeRest['id']);
      
      String? bId;
      String? bName;
      
      if (validBranches.isNotEmpty) {
        var activeBranch = validBranches.first;

        // Try to respect last active branch preference if it's in the valid list
        if (profile?['active_branch_id'] != null) {
           final pref = validBranches.firstWhere(
             (b) => b['id'] == profile!['active_branch_id'],
             orElse: () => validBranches.first
           );
           activeBranch = pref;
        }

        bId = activeBranch['id'];
        bName = activeBranch['name'];
        
        // If the preference was invalid (e.g. removed access), sync the new default
        if (profile?['active_branch_id'] != bId && bId != null) {
           _auth.updateActiveBranch(bId);
        }
      }

      state = ContextState(
        restaurantId: activeRest['id'],
        restaurantName: activeRest['name'],
        branchId: bId,
        branchName: bName,
        isLoading: false,
      );
    } else {
      state = state.copyWith(isLoading: false);
    }
  }

  void switchRestaurant(String id, String name) async {
    state = state.copyWith(restaurantId: id, restaurantName: name, branchId: null, branchName: null, isLoading: true);
    final branches = await _auth.getAccessibleBranches(id);
    if (branches.isNotEmpty) {
      state = state.copyWith(branchId: branches.first['id'], branchName: branches.first['name'], isLoading: false);
      _auth.updateActiveBranch(branches.first['id']);
    } else {
      state = state.copyWith(isLoading: false);
    }
  }

  void switchBranch(String id, String name) {
    state = state.copyWith(branchId: id, branchName: name);
    _auth.updateActiveBranch(id);
  }
}

final contextProvider = StateNotifierProvider<ContextNotifier, ContextState>((ref) {
  return ContextNotifier(ref.watch(authServiceProvider));
});
