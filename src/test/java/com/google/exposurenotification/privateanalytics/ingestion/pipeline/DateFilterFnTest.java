/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.google.exposurenotification.privateanalytics.ingestion.pipeline;

import com.google.exposurenotification.privateanalytics.ingestion.model.DataShare;
import com.google.exposurenotification.privateanalytics.ingestion.model.DataShare.DataShareMetadata;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.apache.beam.sdk.testing.PAssert;
import org.apache.beam.sdk.testing.TestPipeline;
import org.apache.beam.sdk.testing.ValidatesRunner;
import org.apache.beam.sdk.transforms.Create;
import org.apache.beam.sdk.transforms.ParDo;
import org.apache.beam.sdk.values.PCollection;
import org.junit.Rule;
import org.junit.Test;
import org.junit.experimental.categories.Category;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

/** Unit tests for {@link DateFilterFn}. */
@RunWith(JUnit4.class)
public class DateFilterFnTest {

  public transient IngestionPipelineOptions options =
      TestPipeline.testingPipelineOptions().as(IngestionPipelineOptions.class);

  @Rule public final transient TestPipeline pipeline = TestPipeline.fromOptions(options);

  @Test
  @Category(ValidatesRunner.class)
  public void testDateFilter() {
    DataShareMetadata meta = DataShareMetadata.builder().setMetricName("sampleMetric").build();
    List<DataShare> dataShares =
        Arrays.asList(
            DataShare.builder()
                .setPath("id1")
                .setCreatedMs(1000L)
                .setDataShareMetadata(meta)
                .build(),
            DataShare.builder()
                .setPath("id2")
                .setCreatedMs(2000L)
                .setDataShareMetadata(meta)
                .build(),
            DataShare.builder()
                .setPath("id3")
                .setCreatedMs(3000L)
                .setDataShareMetadata(meta)
                .build(),
            DataShare.builder().setPath("missing").setDataShareMetadata(meta).build());

    options.setStartTime(2L);
    options.setDuration(1L);
    options.setDeviceAttestation(false);

    PCollection<DataShare> input = pipeline.apply(Create.of(dataShares));

    PCollection<DataShare> output = input.apply(ParDo.of(new DateFilterFn()));

    PAssert.that(output)
        .containsInAnyOrder(
            Collections.singletonList(
                DataShare.builder()
                    .setPath("id2")
                    .setCreatedMs(2000L)
                    .setDataShareMetadata(meta)
                    .build()));
    pipeline.run().waitUntilFinish();
  }
}
