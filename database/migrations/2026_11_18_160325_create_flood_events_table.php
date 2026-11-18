<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('flood_events', function (Blueprint $table) {
            $table->id();
            $table->string('kode_identitas')->nullable();
            $table->date('tanggal_kejadian')->nullable();
            $table->unsignedSmallInteger('tahun')->index();
            $table->string('kabupaten')->index();
            $table->text('lokasi')->nullable();
            $table->unsignedInteger('meninggal')->nullable();
            $table->unsignedInteger('hilang')->nullable();
            $table->unsignedInteger('terluka')->nullable();
            $table->unsignedInteger('rumah_rusak')->nullable();
            $table->unsignedInteger('rumah_terendam')->nullable();
            $table->unsignedInteger('fasum_rusak')->nullable();
            $table->decimal('curah_hujan_mm', 10, 4)->nullable();
            $table->decimal('jumlah_penduduk_ribu', 10, 2)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('flood_events');
    }
};
