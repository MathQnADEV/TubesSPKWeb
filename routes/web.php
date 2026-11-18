<?php

use App\Http\Controllers\FloodEventController;
use App\Http\Controllers\SpkController;
use Illuminate\Support\Facades\Route;

Route::get('/', [SpkController::class, 'index'])->name('home');
Route::get('data', [SpkController::class, 'data'])->name('spk.data');
Route::get('perhitungan', [SpkController::class, 'calculation'])->name('spk.calculation');
Route::post('data/import', [FloodEventController::class, 'import'])->name('spk.import');
Route::post('data/reset', [SpkController::class, 'reset'])->name('spk.reset');
Route::get('data/curah-hujan', [FloodEventController::class, 'rainfall'])->name('spk.rainfall');
Route::post('data/kejadian', [FloodEventController::class, 'store'])->name('spk.events.store');
Route::put('data/kejadian/{floodEvent}', [FloodEventController::class, 'update'])->name('spk.events.update');
Route::delete('data/kejadian/{floodEvent}', [FloodEventController::class, 'destroy'])->name('spk.events.destroy');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
});

require __DIR__.'/settings.php';
